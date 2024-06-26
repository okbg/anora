const path = require("path");
const process = require("process");
const { writeFile } = require("fs/promises");
const { spawn } = require("child_process");
const { Config } = require("../config");
const { renderDockerfile } = require("./templating");
const { info } = require("./logging");

/**
 * @async
 * @param {Config} config Config to use
 * @returns {Promise<void>} Resolves after Dockerfile has been successfully updated
 */
async function updateDockerfile(config) {
  const dockerfile = await renderDockerfile(config);
  const outputPath = path.join(process.cwd(), "Dockerfile");
  await writeFile(outputPath, dockerfile, { encoding: "utf-8" });
  info("Dockerfile updated");
}

/**
 * @param {string[]} args Docker arguments
 * @param {boolean} [pipeStdOut] Pipe child stdout to process.stdout. Default true.
 * @returns {Promise<void>} Resolves after child process has exited successfully
 */
function spawnDocker(args, pipeStdOut = true) {
  return new Promise((resolve, reject) => {
    info(`docker ${args.join(" ")}`);
    const child = spawn("docker", args);
    if (pipeStdOut) {
      child.stdout.pipe(process.stdout);
    }
    child.stderr.pipe(process.stderr);
    child.on("error", console.error);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Docker exited with code ${code}`));
      }
    });
  });
}

/**
 * @param {Config} config Config to use
 * @returns {Promise<object>} Resolves with object, or null if not found
 */
function inspect(config) {
  return new Promise((resolve) => {
    let output = "";
    const child = spawn("docker", ["inspect", config.name]);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (data) => {
      output += data.toString();
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(JSON.parse(output));
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * @async
 * @param {Config} config Config to use
 * @returns {Promise<void>} Resolved on build succeed
 */
async function build(config) {
  await spawnDocker([
    "build",
    "-t",
    `${config.projectName}:${config.projectVersion}`,
    "-f",
    path.join(process.cwd(), "Dockerfile"),
    process.cwd(),
  ]);
}

/**
 * @async
 * @param {Config} config Config to use
 * @returns {Promise<void>} Resolved when container is stopped
 */
async function run(config) {
  const name = config.projectName;
  const version = config.projectVersion;

  const args = [];
  args.push("run");
  args.push("--rm");
  args.push("-p");
  args.push("3000:3000");
  if (config.envFile) {
    args.push("--env-file");
    args.push(config.envFile);
  }
  args.push("--name");
  args.push(name);
  args.push(`${name}:${version}`);

  await spawnDocker(args);
}

module.exports = { updateDockerfile, inspect, build, run };
