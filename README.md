 # JIRA to GitHub Issues Importer

 This has been specifically developed to migrate issues for Fluid Infusion. It may be usable and/or adaptable for other projects, but those use cases have not been considered.

 ## Installation

 Requires node.js and tested using v22.15.0.

 This package has not been published, so you'll need to run from source after cloning the project locally.

 ## Running

The general flow for using the tool is:

- Fetch issues from JIRA
- Create a map of JIRA users to GitHub users
- Create a map of JIRA versions to GitHub milestones
- Import the fetched issues to GitHub

When running commands you can call

```bash
node --env-file ./src/cli.js {command name} {...command options}
```

In using this method you can pass in environment variables via an .env file. In general options can be passed in either via environment variables or command line options.

### Fetch Issues

(optional but recommended)

Pre-fetches the requested issues from a JIRA instance using a jql query string. The results are returned in JSON and written to the specified location.

Handles rate limiting for JIRA API requests, and may pause to allow for limits to refresh.

#### Command

`fetchIssues`

```bash
node ./src/cli.js fetchIssues {...command parameters}
```

#### Parameters

##### `--url` _(optional)_

JIRA API URL to use for querying issues.

- aliases
  - `-u`
- environment variable
  - `J2GH_URL`
- default
  - `"https://fluidproject.atlassian.net/rest/api/3/search/jql"`

##### `--params` _(optional)_

JIRA API query params for querying issues.

- aliases
  - `-p`
- environment variable
  - `J2GH_PARAMS`
- default
  - `'{"jql":"project = FLUID AND resolution = Migrated ORDER BY created ASC","fields":"*all"}'`

##### `--output` _(optional)_

The path to write the JSON output to.

- aliases
  - `-o`
- environment variable
  - `J2GH_OUTPUT`
- default
  - `"./issues.json"`

#### Output

The command will create a JSON file with an array of objects with data for each fetched issue. This is standard return from the [JIRA API's JQL Search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/#api-rest-api-3-search-jql-get).
However, items in [ADF](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/)
(description, environment, comments) are converted to markdown.

**Example**

```json
[
  {
    ...
    "key": "PROJECT-1",
    "fields": {...}
  }
]
```

### Fetch Attachments

(optional)

The importer does not support importing attachments, but can add links to them. You may wish to download the attachments from JIRA and store them in another accessible location to link to. After which you can leave the links in the issue description or manually attach them to the issue.

Handles rate limiting for JIRA API requests, and may pause to allow for limits to refresh.

#### Command

`fetchIssues`

```bash
node ./src/cli.js fetchIssues {...command parameters}
```

#### Parameters

##### `--file`

The path to the JSON file containing the pre-fetched JIRA issues (See: `fetchIssues`).

- aliases
  - `-f`
- environment variable
  - `J2GH_FILE`

##### `--output`

The path to write the JSON output to.

- aliases
  - `-o`
- environment variable
  - `J2GH_OUTPUT`

##### `--dryRun` _(optional)_

A boolean indicating if a dry run should be performed instead of actually fetching the attachments.

- aliases
  - `--dry-run`
  - `--dryrun`
  - `--test`
- environment variable
  - `J2GH_DRY_RUN`
- default
  - `false`

#### Output

Attachments are written to the output location. They are organized by project, and within the project by issue.

**Example**

```
- {output/path}
  - {project key}
    - {issue key}
      - {attachment file name}
```

### Generate User Map

(optional)

Generates a file to use for mapping JIRA users to GitHub accounts. If any JIRA user isn't mapped to a GitHub account, the JIRA username will be used instead.

#### Command

`generateUserMap`

```bash
node ./src/cli.js generateUserMap {...command parameters}
```

#### Parameters

##### `--file`

The path to the JSON file containing the pre-fetched JIRA issues (See: `fetchIssues`).

- aliases
  - `-f`
- environment variable
  - `J2GH_FILE`

##### `--output`

The path to write the JSON output to.

- aliases
  - `-o`
- environment variable
  - `J2GH_OUTPUT`
- default
  - `"./output.json"`

##### `--dryRun` _(optional)_

A boolean indicating if a dry run should be performed instead of actually generating the user map file.

- aliases
  - `--dry-run`
  - `--dryrun`
  - `--test`
- environment variable
  - `J2GH_DRY_RUN`
- default
  - `false`

#### Output

The command will create a JSON file keyed off the JIRA user id and the value being an object containing the `name` (JIRA username), `link` (JIRA API link to the user data; may require authentication), and `github` (empty value to be replaced with the GitHub username).

**Example**

```json
{
  "{JIRA ID}": {
    "name": "{JIRA username}",
    "link": "{URL to JIRA REST API for the user account}",
    "github": ""
  }
}
```

### Generate Milestone Map

(optional)

Generates a file to use for mapping JIRA versions to GitHub milestones. Any JIRA versions not mapped to a GitHub milestone will be ignored.

GitHub milestones are referenced by their id number (as either a string or number), not by the milestone name. Additionally this means you will need to create the milestones before adding their ids to the generated map file.

#### Command

`generateMilestoneMap`

```bash
node ./src/cli.js generateMilestoneMap {...command parameters}
```

#### Parameters

##### `--file`

The path to the JSON file containing the pre-fetched JIRA issues (See: `fetchIssues`).

- aliases
  - `-f`
- environment variable
  - `J2GH_FILE`

##### `--output`

The path to write the JSON output to.

- aliases
  - `-o`
- environment variable
  - `J2GH_OUTPUT`
- default
  - `"./output.json"`

##### `--dryRun` _(optional)_

A boolean indicating if a dry run should be performed instead of actually generating the user map file.

- aliases
  - `--dry-run`
  - `--dryrun`
  - `--test`
- environment variable
  - `J2GH_DRY_RUN`
- default
  - `false`

##### `--semver` _(optional)_

A boolean indicating if the JIRA versions should be treated as semver.

When treating as, if they aren't semver compliant, it will attempt to coerce them into a valid semver version.

e.g `1.2beta1` will become `1.2.0-beta.1`

- environment variable
  - `J2GH_SEMVER`
- default
  - `true`

#### Output

The command will create a JSON file keyed off the JIRA version name and the value being an empty string to be replaced with the GitHub milestone id.

**Example**

```json
{
  "{JIRA version name}": ""
}
```

### Import Issues

Imports issues from JIRA to GitHub issues. User and milestone maps can be provided to associated related entries from JIRA to GitHub.

Handles rate limiting for JIRA (if fetching issues directly) and GitHub API requests, and may pause to allow for limits to refresh.

#### Command

This is the default command, and as such, does not have a command name to pass in.

```bash
node ./src/cli.js {...command parameters}
```

#### Parameters

##### `--file`

The path to the JSON file containing the pre-fetched JIRA issues (See: `fetchIssues`).

- aliases
  - `-f`
- environment variable
  - `J2GH_FILE`

##### `--output`

The path to write the JSON output to.

- aliases
  - `-o`
- environment variable
  - `J2GH_OUTPUT`
- default
  - `"./output.json"`

##### `--dryRun` _(optional)_

A boolean indicating if a dry run should be performed instead of actually generating the user map file.

- aliases
  - `--dry-run`
  - `--dryrun`
  - `--test`
- environment variable
  - `J2GH_DRY_RUN`
- default
  - `false`

##### `--userMap` _(optional)_

The path to the JSON file containing the user map (See: `generateUserMap`).

- aliases
  - `--map`
  - `--user-map`
  - `--user_map`
- environment variable
  - `J2GH_USER_MAP`

##### `--milestoneMap` _(optional)_

The path to the JSON file containing the milestone map (See: `generateMilestoneMap`).

- aliases
  - `--milestoneMap`
  - `--milestone-map`
  - `--milestone_map`
  - `--vmap`
  - `--versionMap`
  - `--version-map`
  - `--version_map`
- environment variable
  - `J2GH_MILESTONE_MAP`

##### `--owner` _(required unless dry run)_

The name of the GitHub repo owner (GitHub org or user) where the issues will be imported.

- environment variable
  - `J2GH_OWNER`

##### `--repo` _(required unless dry run)_

The name of the GitHub repo where the issues will be imported.

- environment variable
  - `J2GH_REPO`

##### `--token` _(required for user authentication unless dry run)_

The GitHub personal access token when authenticating as a user. When using this method all of the issues created will come from the related user. The personal access token will require read and write permissions to issues.

- aliases
  - `-t`
- environment variable
  - `J2GH_TOKEN`

see: [Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-a`ccess-tokens)

##### `--appId` _(required for GitHub App authentication unless dry run)_

The GitHub App id for authenticating as a GitHub App. When using this method all of the issues created will come from the GitHub App. The GitHub App will require read and write permissions to issues.

- aliases
  - `--appID`
  - `--app-id`
  - `--app_id`
- environment variable
  - `J2GH_APP_ID`

see:
- [About creating GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps)
- [An access token created from a GitHub App](https://devopsjournal.io/blog/2022/01/03/GitHub-Tokens#3-an-access-token-created-from-a-github-app)

##### `--installationId` _(required for GitHub App authentication unless dry run)_

The GitHub App installation id for authenticating as a GitHub App. When using this method all of the issues created will come from the GitHub App. The GitHub App will require read and write permissions to issues.

- aliases
  - `--installationID`
  - `--installation-id`
  - `--installation_id`
- environment variable
  - `J2GH_INSTALLATION_ID`

see:
- [About creating GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps)
- [An access token created from a GitHub App](https://devopsjournal.io/blog/2022/01/03/GitHub-Tokens#3-an-access-token-created-from-a-github-app)

##### `--privateKey` _(required for GitHub App authentication unless dry run)_

The GitHub App private key for authenticating as a GitHub App. When using this method all of the issues created will come from the GitHub App. The GitHub App will require read and write permissions to issues.

- aliases
  - `--private-key`
  - `--private_key`
- environment variable
  - `J2GH_PRIVATE_KEY`

see:
- [About creating GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps)
- [An access token created from a GitHub App](https://devopsjournal.io/blog/2022/01/03/GitHub-Tokens#3-an-access-token-created-from-a-github-app)

##### `--issueBaseUrl` _(optional)_

The base URL used for linking back to the issue. The issues pathname will be appended to this.

- aliases
  - `--issue-base-url`
  - `--issue_base_url`
- environment variable
  - `J2GH_ISSUE_BASE_URL`
- default
  - The issue base url is derived from the JIRA issue's URL

##### `--attachmentBaseUrl` _(optional)_

The base URL used for linking to attachments. This is used, for example, when attachments are being hosted elsewhere.

- aliases
  - `--attachment-base-url`
  - `--attachment_base_url`
- environment variable
  - `J2GH_ATTACHMENT_BASE_URL`
- default
  - The attachment base url is derived from the JIRA issue's URL

##### `--exclude` _(optional)_

The path to a JSON file containing an array of JIRA issue keys to exclude from import. Takes precedence over includes.

- environment variable
  - `J2GH_EXCLUDE`

##### `--include` _(optional)_

The path to a JSON file containing an array of JIRA issue keys to include in the import. Is superseded by excludes.

##### `--includeKeyInTitle` _(optional)_

A boolean indicating if the JIRA issue key should be included in the GitHub issue title.

e.g with key `[ISSUE-###] My migrated issue` and without key `My migrated issue`

- aliases
  - `--include-key-in-title`
  - `--include_key_in_title`
- environment variable
  - `J2GH_INCLUDE_KEY_IN_TITLE`
- default
  - `true`

##### `--semver` _(optional)_

A boolean indicating if the JIRA versions should be treated as semver.

When treating as, if they aren't semver compliant, it will attempt to coerce them into a valid semver version.

e.g `1.2beta1` will become `1.2.0-beta.1`

- environment variable
  - `J2GH_SEMVER`
- default
  - `true`

#### Output

<!-- TODO: -->

**Example**

```json
{
  "{JIRA version name}": ""
}
```

## Logging

Commands that make API requests will log their progress and errors to the console and to an `app.log` file created in the same directory the commands are called from.

Logging is done using [Pino](https://getpino.io/#/). By default the log level is set to `'info'` but can be changed to any supported [level](https://getpino.io/#/docs/api?id=level-string), and can be set using the `PINO_LOG_LEVEL` environment variable.

## Environment variables

<!-- mention Required environment variables, parameters that can be set with environment variables -->

You can use an `.env` file to pass in environment variables.

```bash
node --env-file {path to env file} ./src/cli.js {command name} {...command parameters}
```
