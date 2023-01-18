// Package graph contains the CompleteGraph struct and some methods around it
package graph

import (
	gocontext "context"
	"fmt"

	"github.com/pyr-sh/dag"
	"github.com/vercel/turbo/cli/internal/fs"
	"github.com/vercel/turbo/cli/internal/nodes"
	"github.com/vercel/turbo/cli/internal/turbopath"
	"github.com/vercel/turbo/cli/internal/util"
)

// WorkspaceInfos holds information about each workspace in the monorepo.
type WorkspaceInfos map[string]*fs.PackageJSON

// CompleteGraph represents the common state inferred from the filesystem and pipeline.
// It is not intended to include information specific to a particular run.
type CompleteGraph struct {
	// WorkspaceGraph expresses the dependencies between packages
	WorkspaceGraph dag.AcyclicGraph

	// Pipeline is config from turbo.json
	Pipeline fs.Pipeline

	// WorkspaceInfos stores the package.json contents by package name
	WorkspaceInfos WorkspaceInfos

	// GlobalHash is the hash of all global dependencies
	GlobalHash string

	RootNode string
}

func (g *CompleteGraph) GetComposedPackageTaskVisitor(ctx gocontext.Context, visitor func(ctx gocontext.Context, packageTask *nodes.PackageTask) error) func(taskID string) error {
	return func(taskID string) error {
		packageName, taskName := util.GetPackageTaskFromId(taskID)

		pkg, ok := g.WorkspaceInfos[packageName]
		if !ok {
			return fmt.Errorf("cannot find package %v for task %v", packageName, taskID)
		}

		// Start a list of TaskDefinitions we've found for this TaskID
		taskDefinitions := []fs.TaskDefinition{}

		// Start in the workspace directory
		directory := turbopath.AbsoluteSystemPath(pkg.Dir)
		turboJSONPath := directory.UntypedJoin("turbo.json")
		_, err := fs.ReadTurboConfigFromPath(turboJSONPath)

		// If there is no turbo.json in the workspace directory, we'll use the one in root
		// and carry on
		if err != nil {
			rootTaskDefinition, _ := getTaskFromPipeline(g.Pipeline, taskID, taskName)
			taskDefinitions = append(taskDefinitions, rootTaskDefinition)
		} else {
			// For loop until we `break` manually.
			// We will reassign `turboJSONPath` inside this loop, so that
			// every time we iterate, we're starting from a new one.
			for {
				turboJSON, err := fs.ReadTurboConfigFromPath(turboJSONPath)
				if err != nil {
					return err
				}

				pipeline := turboJSON.Pipeline
				// TODO(mehulkar):
				// 		getTaskFromPipeline falls allows searching with a taskID (e.g. `package#task`) concif
				// 		But we do not want to allow this, except if we're in the root workspace.
				taskDefinition, err := getTaskFromPipeline(pipeline, taskID, taskName)
				if err != nil {
					// we don't need to do anything if no taskDefinition was found in this pipeline
				} else {
					// Add it into the taskDefinitions
					taskDefinitions = append(taskDefinitions, taskDefinition)

					// If this turboJSON doesn't have an extends property, we can stop our for loop here.
					if len(turboJSON.Extends) == 0 {
						break
					}

					// TODO(mehulkar): Enable extending from more than one workspace.
					if len(turboJSON.Extends) > 1 {
						return fmt.Errorf(
							"You can only extend from one workspace, %s extends from %v",
							pkg.Name,
							len(turboJSON.Extends),
						)
					}

					// If there's an extends property, walk up to the next one
					// Find the workspace it refers to, and and assign `directory` to it for the
					// next iteration in this for loop.
					// Note(mehulkar): We are looking through Extends right now because of the way the
					// way this for loop is structured -- and we eventually _want_ to do this --
					// but right now this loop should only happen once, and it should only contain the root workspace name.
					for _, workspaceName := range turboJSON.Extends {
						// TODO(mehulkar): Allow enabling from non-root workspaces
						if workspaceName != util.RootPkgName {
							return fmt.Errorf(
								"You can only extend from the root workspace, %s extends from %s",
								pkg.Name,
								workspaceName,
							)
						}

						workspace, ok := g.WorkspaceInfos[workspaceName]
						if !ok {
							// TODO: Should this be a hard error?
							// A workspace was referenced that doesn't exist or we know nothing about
							break
						}

						// Reassign these. The loop will run again with this new turbo.json now.
						directory = turbopath.AbsoluteSystemPath(workspace.Dir)
						turboJSONPath = directory.UntypedJoin("turbo.json")
					}
				}
			}
			//-------------------------
		}

		// reverse the array, because we want to start with the end of the chain.
		for i, j := 0, len(taskDefinitions)-1; i < j; i, j = i+1, j-1 {
			taskDefinitions[i], taskDefinitions[j] = taskDefinitions[j], taskDefinitions[i]
		}

		// Start with an empty definition
		mergedTaskDefinition := &fs.TaskDefinition{}

		// For each of the TaskDefinitions we know of, merge them in
		for _, taskDef := range taskDefinitions {
			mergedTaskDefinition.Outputs = taskDef.Outputs
			mergedTaskDefinition.Outputs = taskDef.Outputs
			mergedTaskDefinition.ShouldCache = taskDef.ShouldCache
			mergedTaskDefinition.EnvVarDependencies = taskDef.EnvVarDependencies
			mergedTaskDefinition.TopologicalDependencies = taskDef.TopologicalDependencies
			mergedTaskDefinition.TaskDependencies = taskDef.TaskDependencies
			mergedTaskDefinition.Inputs = taskDef.Inputs
			mergedTaskDefinition.OutputMode = taskDef.OutputMode
			mergedTaskDefinition.Persistent = taskDef.Persistent
		}

		packageTask := &nodes.PackageTask{
			TaskID:         taskID,
			Task:           taskName,
			PackageName:    packageName,
			Pkg:            pkg,
			TaskDefinition: mergedTaskDefinition,
		}

		return visitor(ctx, packageTask)
	}
}

// GetPackageTaskVisitor wraps a `visitor` function that is used for walking the TaskGraph
// during execution (or dry-runs). The function returned here does not execute any tasks itself,
// but it helps curry some data from the Complete Graph and pass it into the visitor function.
func (g *CompleteGraph) GetPackageTaskVisitor(ctx gocontext.Context, visitor func(ctx gocontext.Context, packageTask *nodes.PackageTask) error) func(taskID string) error {
	return func(taskID string) error {
		packageName, taskName := util.GetPackageTaskFromId(taskID)

		pkg, ok := g.WorkspaceInfos[packageName]
		if !ok {
			return fmt.Errorf("cannot find package %v for task %v", packageName, taskID)
		}

		// first check for package-tasks
		taskDefinition, ok := g.Pipeline[fmt.Sprintf("%v", taskID)]

		if !ok {
			// then check for regular tasks
			fallbackTaskDefinition, notcool := g.Pipeline[taskName]
			// if neither, then bail
			if !notcool {
				return nil
			}
			// override if we need to...
			taskDefinition = fallbackTaskDefinition
		}

		packageTask := &nodes.PackageTask{
			TaskID:         taskID,
			Task:           taskName,
			PackageName:    packageName,
			Pkg:            pkg,
			TaskDefinition: &taskDefinition,
		}

		return visitor(ctx, packageTask)
	}
}

func getTaskFromPipeline(pipeline fs.Pipeline, taskID string, taskName string) (fs.TaskDefinition, error) {
	// first check for package-tasks
	taskDefinition, ok := pipeline[taskID]
	if !ok {
		// then check for regular tasks
		fallbackTaskDefinition, notcool := pipeline[taskName]
		// if neither, then bail
		if !notcool {
			// Return an empty fs.TaskDefinition
			return fs.TaskDefinition{}, fmt.Errorf("No task defined in pipeline")
		}

		// override if we need to...
		taskDefinition = fallbackTaskDefinition
	}

	return taskDefinition, nil
}
