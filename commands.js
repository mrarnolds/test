const argv = require("minimist-lite")(process.argv.slice(2));
const shell = require("shelljs");
const axios = require("axios");
const fsp = require("fs/promises");

async function syncConfigFiles() {
  const urlAndPath = [
    {
      url: "https://myplaceportal.uk/api/config",
      path: "./src/assets/config/myplaceportal_uk.json",
    },
    {
      url: "https://www.myplaceportal.uk/api/config",
      path: "./src/assets/config/www_myplaceportal_uk.json",
    },
  ];

  for (const item of urlAndPath) {
    try {
      const { data } = await axios.get(item.url);
      await fsp.writeFile(item.path, JSON.stringify(data));
    } catch (e) {
      console.log(e);
    }
  }
}

/**
 * Prepares Husky by setting up hooks and ensuring they have the right permissions,
 *  skipping setup in CI environments.
 */
function prepareHusky() {
  // Cross-platform environment check to skip Husky setup if running in a CI environment
  if (process.env.CI === "true") {
    return;
  }

  // Execute Husky setup and permission changes, ensuring hooks are executable
  const result = shell.exec("husky && bash -c 'chmod ug+x .husky/*'");
  if (result.code !== 0) {
    console.error("Error running Husky or setting permissions:", result.stderr);
    process.exit(result.code);
  }
}

switch (argv.command) {
  case "conf-sync":
    syncConfigFiles();
    break;

  case "prepare":
    prepareHusky();
    break;
}
