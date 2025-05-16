const argv = require("minimist-lite")(process.argv.slice(2));
const shell = require("shelljs");
const http = require("http");
const axios = require("axios");
const fs = require("fs");
const fsp = require("fs/promises");

// UUID for unique file naming to ensure no one can guess the URL
const changelogUuid = "e1bdc239-af43-494f-b19d-7fb5ce8a6125";
const changelogOutputFilePath = `./src/assets/changelog-public-${changelogUuid}.md`;

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
 * Function to generate a user friendly changelog to display in the portal.
 * Manually generates the changelog via regex.
 */
function generatePublicChangelogViaRegex() {
  const defaultIncludedSections = ["Features", "Bug Fixes"];
  const defaultMaxReleases = 10;
  const defaultIncludeEmptyReleases = false;

  // Determine which sections to include based on environment variables or default values
  const includedSections = process.env.INCLUDED_SECTIONS
    ? process.env.INCLUDED_SECTIONS.split(",")
    : defaultIncludedSections;

  // Set the maximum number of releases to include from environment variables or default value
  const maxReleases = parseInt(process.env.MAX_RELEASES) || defaultMaxReleases;

  // Determine whether to include empty releases from environment variable or default value
  const includeEmptyReleases =
    process.env.INCLUDE_EMPTY_RELEASES === undefined
      ? defaultIncludeEmptyReleases
      : process.env.INCLUDE_EMPTY_RELEASES !== "false";

  // Read the original changelog content
  const changelogContent = fs.readFileSync("CHANGELOG.md", "utf8");
  const lines = changelogContent.split("\n");

  let output = [];
  let releaseCount = 0;
  let inSection = false;
  let previousLineWasRelease = false;
  let currentReleaseHasContent = false;
  let tempReleaseLine = "";

  for (let line of lines) {
    // Regex to check if the line is a release heading
    const isReleaseHeading =
      /^### \[?(\d+\.\d+\.\d+)\]?/.test(line) ||
      /^## \[?(\d+\.\d+\.\d+)\]?/.test(line);
    // Regex to check if the line is a section heading (like '### Features')
    const isSectionHeading = /^### (.+)/.exec(line);

    if (isReleaseHeading) {
      // Format release line
      line = line
        // Removes brackets around version number
        .replace(/\[?(\d+\.\d+\.\d+)\]?/, "$1")
        // Removes the URL
        .replace(/\(https:\/\/[^\)]+\)/, "")
        .trim();

      currentReleaseHasContent = false;
      if (releaseCount < maxReleases) {
        if (includeEmptyReleases) {
          // Add a newline before the release heading if the previous line was also a release heading
          if (previousLineWasRelease) {
            output.push("\n" + line);
          } else {
            output.push(line);
          }
        } else {
          tempReleaseLine = line;
        }
        previousLineWasRelease = true;
        releaseCount++;
      } else {
        // Stop processing further releases
        break;
      }
      inSection = false;
    } else if (releaseCount > 0 && releaseCount <= maxReleases) {
      // Process section headings and content
      if (isSectionHeading) {
        // Check if the current section is one of the included sections
        inSection = includedSections.includes(isSectionHeading[1]);
        if (inSection) {
          if (!includeEmptyReleases && !currentReleaseHasContent) {
            output.push(tempReleaseLine);
            currentReleaseHasContent = true;
          }
          // Add a newline before section headings
          output.push("\n" + line);
          previousLineWasRelease = false;
        }
      } else if (inSection) {
        // Format list items
        line = line
          // Replace asterisks with hyphens
          .replace(/^\* /, "- ")
          // Remove commit hash and URL
          .replace(/\(\[\w+\]\(https:\/\/[^\)]+\)\)/, "")
          // Remove JIRA ticket numbers
          .replace(/(\s*\b[A-Z]+-\d+\b)+/g, "")
          .trim();

        if (!includeEmptyReleases && !currentReleaseHasContent) {
          output.push(tempReleaseLine);
          currentReleaseHasContent = true;
        }
        output.push(line);
      }
    }
  }

  // Post-processing step to remove multiple consecutive line breaks
  const formattedOutput = output.join("\n").replace(/\n{2,}/g, "\n\n");

  // Write the formatted changelog to a new file
  fs.writeFileSync(changelogOutputFilePath, formattedOutput, "utf8");

  return changelogOutputFilePath;
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

  case "changelog-public-regex":
    const changelogPath = generatePublicChangelogViaRegex();
    console.log(changelogPath);
    break;

  case "prepare":
    prepareHusky();
    break;
}
