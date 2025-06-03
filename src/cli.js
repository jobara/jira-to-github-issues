#!/usr/bin/env node

import jsonfile from 'jsonfile';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers'
import * as jira2github from '../index.js'

yargs(hideBin(process.argv))
    .usage('Usage: $0 <command> [options]')
    .command({
        command: '$0',
        desc: 'Exports JIRA issues to GitHub',
        handler: async (argv) => {
            let options = {};

            if (argv.owner) {
                options.owner = argv.owner;
            } else if (!argv.dryRun) {
                throw new Error("owner required");
            }

            if (argv.repo) {
                options.repo = argv.repo;
            } else if (!argv.dryRun) {
                throw new Error("repo required");
            }

            if (argv.token) {
                options.token = argv.token;
            } else if (!argv.dryRun && (!argv.appId || !argv.installationId || !argv.privateKey)) {
                throw new Error("Personal access token or GitHub app credentials are required");
            }

            if (argv.appId) {
                options.appId = argv.appId;
            }

            if (argv.privateKey) {
                options.privateKey = argv.privateKey;
            }

            if (argv.installationId) {
                options.installationId = argv.installationId;
            }

            if (argv.includeKeyInTitle) {
                options.includeKeyInTitle = argv.includeKeyInTitle;
            }

            if (argv.issueBaseUrl) {
                options.issueBaseUrl = argv.issueBaseUrl;
            }

            if (argv.attachmentBaseUrl) {
                options.attachmentBaseUrl = argv.attachmentBaseUrl;
            }

            if (argv.exclude) {
                try {
                    options.exclude = await jsonfile.readFile(argv.exclude);
                } catch (err) {
                    throw err;
                }
            }

            if (argv.include) {
                try {
                    options.include = await jsonfile.readFile(argv.include);
                } catch (err) {
                    throw err;
                }
            }

            if (argv.semver) {
                options.semver = argv.semver;
            }

            jira2github.importIssues(argv.file, argv.output, argv.map, argv.vmap, argv.dryRun, options);
        }
    })
    // .command({
    //     command: 'convertExportDataToJson',
    //     aliases: ['convertExportDataToJson', 'toJson'],
    //     desc: 'Converts the JIRA export data from XML to JSON',
    //     handler: async (argv) => {
    //         jira2github.exportDataToJson(argv.file, argv.output, argv.dryRun);
    //     }
    // })
    .command({
        command: 'generateUserMap',
        desc: 'Generate a user map which can be used to map JIRA user IDs to GitHub accounts.',
        handler: async (argv) => {
            jira2github.generateUserMap(argv.file, argv.output, argv.dryRun);
        }
    })
    .command({
        command: 'generateMilestoneMap',
        desc: 'Generate a milestone map which can be used to map JIRA versions to GitHub milestone ids.',
        handler: async (argv) => {
            jira2github.generateMilestoneMap(argv.file, argv.output, argv.dryRun, argv.semver);
        }
    })
    .command({
        command: 'fetchAttachments',
        aliases: ['fetchAttachments', 'attachments'],
        desc: 'Download attachments',
        handler: async (argv) => {
            jira2github.fetchAttachments(argv.file, argv.output, argv.dryRun);
        }
    })
    .command({
        command: 'fetchIssues',
        aliases: ['issues'],
        desc: 'Retrieve issues from JIRA',
        handler: async (argv) => {
            jira2github.fetchIssues(argv.url, argv.params, argv.output);
        }
    })
    // .command({
    //     command: 'getIssueTypes',
    //     handler: async (argv) => {
    //         jira2github.getIssueTypes(argv.file, argv.output);
    //     }
    // })
    // .command({
    //     command: 'getLabels',
    //     handler: async (argv) => {
    //         jira2github.getLabels(argv.file, argv.output);
    //     }
    // })
    // .command({
    //     command: 'getStatuses',
    //     handler: async (argv) => {
    //         jira2github.getStatuses(argv.file, argv.output);
    //     }
    // })
    .command({
        command: 'getKeys',
        handler: async (argv) => {
            jira2github.getKeys(argv.file, argv.output);
        }
    })
    .demandCommand(1)
    .env('J2GH')
    .alias('f', 'file')
    .nargs('f', 1)
    .describe('f', 'Path to JIRA export data file')
    .boolean(['dry-run', 'include-key-in-title', 'semver'])
    // .boolean(['json', 'dry-run'])
    // .describe('json', 'Indicate if the JIRA export file is in JSON fortmat. Otherwise it is expected to be XML')
    .alias('dry-run', ['dry_run', 'dryrun', 'dryRun', 'test'])
    .describe('dry-run', 'Print output to console; useful for testing before performing actions')
    .alias('o', 'output')
    .nargs('o', 1)
    .default('o', 'output.json')
    .describe('o', 'Path to write JSON output file to')
    .alias('map', ['userMap', 'user-map', 'user_map'])
    .nargs('map', 1)
    .describe('map', 'Path to user map; which maps the JIRA ids to GitHub accounts')
    .alias('vmap', ['versionMap', 'version-map', 'version_map', 'milestoneMap', 'milestone-map', 'milestone_map'])
    .nargs('vmap', 1)
    .describe('vmap', 'Path to milestone map; which maps the JIRA versions to GitHub milestone ids')
    .alias('t', 'token')
    .nargs('t', 1)
    .describe('t', 'Personal Access token for connecting to GitHub.')
    .alias('appId', ['app-id', 'appID', 'app_id'])
    .nargs('appId', 1)
    .describe('appId', 'App ID of GitHub App for connecting to GitHub.')
    .alias('installationId', ['installation-id', 'installationID', 'installation_id'])
    .nargs('installationId', 1)
    .describe('installationId', 'Installation ID of GitHub App for connecting to GitHub.')
    .alias('privateKey', ['private-key', 'private_key'])
    .nargs('privateKey', 1)
    .describe('privateKey', 'Private Key of GitHub App for connecting to GitHub.')
    .nargs('owner', 1)
    .describe('owner', 'Owner or GitHub org for the repo to post the issues to.')
    .alias('r', 'repo')
    .nargs('r', 1)
    .describe('r', 'Name of the GitHub repo to post the issues to.')
    .alias('include-key-in-title', ['includeKeyInTitle', '--include_key_in_title'])
    .describe('include-key-in-title', 'Include the JIRA key in the GitHub issue title')
    .describe('semver', 'Convert JIRA issue numbers to semver')
    .default('semver', true)
    .alias('issue-base-url', ['issueBaseUrl', 'issue_base_url'])
    .nargs('issue-base-url', 1)
    .describe('issue-base-url', 'The base URL to use for linking back to the original issue. For example to reference an alias url instead of the fetched url.')
    .alias('attachment-base-url', ['attachmentBaseUrl', 'attachment_base_url'])
    .nargs('attachment-base-url', 1)
    .describe('attachment-base-url', 'The base URL to use for linking to the attachments. Use for example when the attachments are being hosted elsewhere.')
    .alias('u', 'url')
    .nargs('u', 1)
    .describe('u', 'JIRA API URL to use for querying issues')
    .alias('p', 'params')
    .nargs('p', 1)
    .describe('p', 'JIRA API query params for querying issues')
    .nargs('exclude', 1)
    .describe('exclude', 'Issue keys to exclude. Takes precedence over include.')
    .nargs('include', 1)
    .describe('include', 'Issue keys to include')
    // .demandOption()
    .help('h')
    .alias('h', 'help')
    .parse()
