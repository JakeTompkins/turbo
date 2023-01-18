import { setupTestFixtures } from "./test-utils";
import getTurboUpgradeCommand from "../src/commands/migrate/steps/getTurboUpgradeCommand";
import * as utils from "../src/commands/migrate/utils";
import * as getPackageManager from "../src/utils/getPackageManager";
import * as getPackageManagerVersion from "../src/utils/getPackageManagerVersion";

const LOCAL_INSTALL_COMMANDS = [
  // npm - workspaces
  [
    "npm",
    "7.0.0",
    "normal-workspaces-dev-install",
    "npm install turbo@latest --save-dev",
  ],
  ["npm", "7.0.0", "normal-workspaces", "npm install turbo@latest"],
  // npm - single package
  [
    "npm",
    "7.0.0",
    "single-package-dev-install",
    "npm install turbo@latest --save-dev",
  ],
  ["npm", "7.0.0", "single-package", "npm install turbo@latest"],
  // pnpm - workspaces
  [
    "pnpm",
    "7.0.0",
    "pnpm-workspaces-dev-install",
    "pnpm install turbo@latest --save-dev -w",
  ],
  ["pnpm", "7.0.0", "pnpm-workspaces", "pnpm install turbo@latest -w"],
  // pnpm - single package
  [
    "pnpm",
    "7.0.0",
    "single-package-dev-install",
    "pnpm install turbo@latest --save-dev",
  ],
  ["pnpm", "7.0.0", "single-package", "pnpm install turbo@latest"],
  // yarn 1.x - workspaces
  [
    "yarn",
    "1.22.19",
    "normal-workspaces-dev-install",
    "yarn add turbo@latest --dev -W",
  ],
  ["yarn", "1.22.19", "normal-workspaces", "yarn add turbo@latest -W"],
  // yarn 1.x - single package
  [
    "yarn",
    "1.22.19",
    "single-package-dev-install",
    "yarn add turbo@latest --dev",
  ],
  ["yarn", "1.22.19", "single-package", "yarn add turbo@latest"],
  // yarn 2.x - workspaces
  [
    "yarn",
    "2.3.4",
    "normal-workspaces-dev-install",
    "yarn add turbo@latest --dev",
  ],
  ["yarn", "2.3.4", "normal-workspaces", "yarn add turbo@latest"],
  // yarn 2.x - single package
  [
    "yarn",
    "2.3.4",
    "single-package-dev-install",
    "yarn add turbo@latest --dev",
  ],
  ["yarn", "2.3.4", "single-package", "yarn add turbo@latest"],
  // yarn 3.x - workspaces
  [
    "yarn",
    "3.3.4",
    "normal-workspaces-dev-install",
    "yarn add turbo@latest --dev",
  ],
  ["yarn", "3.3.4", "normal-workspaces", "yarn add turbo@latest"],
  // yarn 3.x - single package
  [
    "yarn",
    "3.3.4",
    "single-package-dev-install",
    "yarn add turbo@latest --dev",
  ],
  ["yarn", "3.3.4", "single-package", "yarn add turbo@latest"],
];

const GLOBAL_INSTALL_COMMANDS = [
  // npm
  [
    "npm",
    "7.0.0",
    "normal-workspaces-dev-install",
    "npm install turbo@latest --global",
  ],
  ["npm", "7.0.0", "normal-workspaces", "npm install turbo@latest --global"],
  ["npm", "7.0.0", "single-package", "npm install turbo@latest --global"],
  [
    "npm",
    "7.0.0",
    "single-package-dev-install",
    "npm install turbo@latest --global",
  ],
  // pnpm
  [
    "pnpm",
    "7.0.0",
    "pnpm-workspaces-dev-install",
    "pnpm install turbo@latest --global",
  ],
  ["pnpm", "7.0.0", "pnpm-workspaces", "pnpm install turbo@latest --global"],
  ["pnpm", "7.0.0", "single-package", "pnpm install turbo@latest --global"],
  [
    "pnpm",
    "7.0.0",
    "single-package-dev-install",
    "pnpm install turbo@latest --global",
  ],
  // yarn 1.x
  [
    "yarn",
    "1.22.19",
    "normal-workspaces-dev-install",
    "yarn global add turbo@latest",
  ],
  ["yarn", "1.22.19", "normal-workspaces", "yarn global add turbo@latest"],
  ["yarn", "1.22.19", "single-package", "yarn global add turbo@latest"],
  [
    "yarn",
    "1.22.19",
    "single-package-dev-install",
    "yarn global add turbo@latest",
  ],
  // yarn 2.x
  [
    "yarn",
    "2.3.4",
    "normal-workspaces-dev-install",
    "yarn global add turbo@latest",
  ],
  ["yarn", "2.3.4", "normal-workspaces", "yarn global add turbo@latest"],
  ["yarn", "2.3.4", "single-package", "yarn global add turbo@latest"],
  [
    "yarn",
    "2.3.4",
    "single-package-dev-install",
    "yarn global add turbo@latest",
  ],
  // yarn 3.x
  [
    "yarn",
    "3.3.3",
    "normal-workspaces-dev-install",
    "yarn global add turbo@latest",
  ],
  ["yarn", "3.3.3", "normal-workspaces", "yarn global add turbo@latest"],
  ["yarn", "3.3.4", "single-package", "yarn global add turbo@latest"],
  [
    "yarn",
    "3.3.4",
    "single-package-dev-install",
    "yarn global add turbo@latest",
  ],
];

describe("get-turbo-upgrade-command", () => {
  const { useFixture } = setupTestFixtures({
    test: "get-turbo-upgrade-command",
  });

  test.each(LOCAL_INSTALL_COMMANDS)(
    "returns correct upgrade command for local install using %s@%s (fixture: %s)",
    (
      packageManager,
      packageManagerVersion,
      fixture,
      expectedUpgradeCommand
    ) => {
      const { root } = useFixture({
        fixture,
      });

      const mockedExec = jest
        .spyOn(utils, "exec")
        .mockImplementation((command: string) => {
          // fail the check for the turbo, and package manager bins to force local
          if (command.includes("bin")) {
            return undefined;
          }
        });
      const mockedGetPackageManagerVersion = jest
        .spyOn(getPackageManagerVersion, "default")
        .mockReturnValue(packageManagerVersion);
      const mockedGetPackageManager = jest
        .spyOn(getPackageManager, "default")
        .mockReturnValue(packageManager as getPackageManager.PackageManager);

      // get the command
      const upgradeCommand = getTurboUpgradeCommand({
        directory: root,
      });

      expect(upgradeCommand).toEqual(expectedUpgradeCommand);

      mockedExec.mockRestore();
      mockedGetPackageManager.mockRestore();
      mockedGetPackageManagerVersion.mockRestore();
    }
  );

  test.each(GLOBAL_INSTALL_COMMANDS)(
    "returns correct upgrade command for global install using %s@%s (fixture: %s)",
    (
      packageManager,
      packageManagerVersion,
      fixture,
      expectedUpgradeCommand
    ) => {
      const { root } = useFixture({
        fixture,
      });

      const mockedExec = jest
        .spyOn(utils, "exec")
        .mockImplementation((command: string) => {
          if (command === "turbo bin") {
            return `/global/${packageManager}/bin/turbo`;
          }
          if (command.includes(packageManager)) {
            return `/global/${packageManager}/bin`;
          }
        });
      const mockedGetPackageManagerVersion = jest
        .spyOn(getPackageManagerVersion, "default")
        .mockReturnValue(packageManagerVersion);
      const mockedGetPackageManager = jest
        .spyOn(getPackageManager, "default")
        .mockReturnValue(packageManager as getPackageManager.PackageManager);

      // get the command
      const upgradeCommand = getTurboUpgradeCommand({
        directory: root,
      });

      expect(upgradeCommand).toEqual(expectedUpgradeCommand);

      mockedExec.mockRestore();
      mockedGetPackageManager.mockRestore();
      mockedGetPackageManagerVersion.mockRestore();
    }
  );

  test("fails gracefully if no package.json exists", () => {
    const { root } = useFixture({
      fixture: "no-package",
    });

    const mockedExec = jest
      .spyOn(utils, "exec")
      .mockImplementation((command: string) => {
        // fail the check for the turbo, and package manager bins to force local
        if (command.includes("bin")) {
          return undefined;
        }
      });

    const mockedGetPackageManagerVersion = jest
      .spyOn(getPackageManagerVersion, "default")
      .mockReturnValue("8.0.0");
    const mockedGetPackageManager = jest
      .spyOn(getPackageManager, "default")
      .mockReturnValue("pnpm" as getPackageManager.PackageManager);

    // get the command
    const upgradeCommand = getTurboUpgradeCommand({
      directory: root,
    });

    expect(upgradeCommand).toEqual(undefined);

    mockedExec.mockRestore();
    mockedGetPackageManager.mockRestore();
    mockedGetPackageManagerVersion.mockRestore();
  });

  test("fails gracefully if turbo cannot be found in package.json", () => {
    const { root } = useFixture({
      fixture: "no-turbo",
    });

    const mockedExec = jest
      .spyOn(utils, "exec")
      .mockImplementation((command: string) => {
        // fail the check for the turbo, and package manager bins to force local
        if (command.includes("bin")) {
          return undefined;
        }
      });

    const mockedGetPackageManagerVersion = jest
      .spyOn(getPackageManagerVersion, "default")
      .mockReturnValue("8.0.0");
    const mockedGetPackageManager = jest
      .spyOn(getPackageManager, "default")
      .mockReturnValue("pnpm" as getPackageManager.PackageManager);

    // get the command
    const upgradeCommand = getTurboUpgradeCommand({
      directory: root,
    });

    expect(upgradeCommand).toEqual(undefined);

    mockedExec.mockRestore();
    mockedGetPackageManager.mockRestore();
    mockedGetPackageManagerVersion.mockRestore();
  });

  test("fails gracefully if package.json has no deps or devDeps", () => {
    const { root } = useFixture({
      fixture: "no-deps",
    });

    const mockedExec = jest
      .spyOn(utils, "exec")
      .mockImplementation((command: string) => {
        // fail the check for the turbo, and package manager bins to force local
        if (command.includes("bin")) {
          return undefined;
        }
      });

    const mockedGetPackageManagerVersion = jest
      .spyOn(getPackageManagerVersion, "default")
      .mockReturnValue("8.0.0");
    const mockedGetPackageManager = jest
      .spyOn(getPackageManager, "default")
      .mockReturnValue("pnpm" as getPackageManager.PackageManager);

    // get the command
    const upgradeCommand = getTurboUpgradeCommand({
      directory: root,
    });

    expect(upgradeCommand).toEqual(undefined);

    mockedExec.mockRestore();
    mockedGetPackageManager.mockRestore();
    mockedGetPackageManagerVersion.mockRestore();
  });

  test("fails gracefully if can't find packageManager", () => {
    const { root } = useFixture({
      fixture: "no-deps",
    });

    const mockedExec = jest
      .spyOn(utils, "exec")
      .mockImplementation((command: string) => {
        // fail the check for the turbo, and package manager bins to force local
        if (command.includes("bin")) {
          return undefined;
        }
      });

    const mockedGetPackageManagerVersion = jest
      .spyOn(getPackageManagerVersion, "default")
      .mockReturnValue("8.0.0");
    const mockedGetPackageManager = jest
      .spyOn(getPackageManager, "default")
      .mockReturnValue("pnpm" as getPackageManager.PackageManager);

    // get the command
    const upgradeCommand = getTurboUpgradeCommand({
      directory: root,
    });

    expect(upgradeCommand).toEqual(undefined);

    mockedExec.mockRestore();
    mockedGetPackageManager.mockRestore();
    mockedGetPackageManagerVersion.mockRestore();
  });
});
