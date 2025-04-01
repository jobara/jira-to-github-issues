#!/usr/bin/env node

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

            if (argv.titleType) {
                options.titleType = argv.titleType;
            }

            jira2github.importIssues(argv.file, argv.output, argv.map, argv.json, argv.dryRun, options);
        }
    })
    .command({
        command: 'convertExportDataToJson',
        aliases: ['convertExportDataToJson', 'toJson'],
        desc: 'Converts the JIRA export data from XML to JSON',
        handler: async (argv) => {
            jira2github.exportDataToJson(argv.file, argv.output, argv.dryRun);
        }
    })
    .command({
        command: 'generateUserMap',
        aliases: ['generateUserMap', 'idmap'],
        desc: 'Generate a user map which can be used to map JIRA user IDs to GitHub accounts.',
        handler: async (argv) => {
            jira2github.generateUserMap(argv.file, argv.output, argv.json, argv.dryRun);
        }
    })
    .command({
        command: 'fetchAttachments',
        aliases: ['fetchAttachments', 'attachments'],
        desc: 'Download attachments',
        handler: async (argv) => {
            jira2github.fetchAttachments(argv.file, argv.output, argv.json, argv.dryRun);
        }
    })
    .demandCommand(1)
    .env('J2GH')
    .alias('f', 'file')
    .nargs('f', 1)
    .describe('f', 'Path to JIRA export data file')
    .boolean(['json', 'dry-run'])
    .describe('json', 'Indicate if the JIRA export file is in JSON fortmat. Otherwise it is expected to be XML')
    .alias('dry-run', ['dryrun', 'dryRun', 'test'])
    .describe('dry-run', 'Print output to console; useful for testing before performing actions')
    .alias('o', 'output')
    .nargs('o', 1)
    .default('o', 'output.json')
    .describe('o', 'Path to write JSON output file to')
    .alias('map', 'userMap')
    .nargs('map', 1)
    .describe('map', 'Path to user map; which maps the JIRA ids to GitHub accounts')
    .alias('t', 'token')
    .nargs('t', 1)
    .describe('t', 'Personal Access token for connecting to GitHub.')
    .alias('appId', ['app-id', 'appID', 'app_id'])
    .nargs('appId', 1)
    .describe('appId', 'App ID of GitHub App for connecting to GitHub.')
    .alias('installationId', ['installation-id', 'installationID', 'installation_id'])
    .nargs('installationId', 1)
    .describe('installationId', 'Installation ID of GitHub App for connecting to GitHub.')
    .alias('privateKey', ['private-key', 'privateKey', 'private_key'])
    .nargs('privateKey', 1)
    .describe('privateKey', 'Private Key of GitHub App for connecting to GitHub.')
    .nargs('owner', 1)
    .describe('owner', 'Owner or GitHub org for the repo to post the issues to.')
    .alias('r', 'repo')
    .nargs('r', 1)
    .describe('r', 'Name of the GitHub repo to post the issues to.')
    .alias('titleType', 'title-type')
    .nargs('titleType', 1)
    .describe('titleType', 'The format for the title can be "title" or "summary"; where title includes the origianl JIRA issue number.')
    .default('titleType', 'title')
    .demandOption(['f'])
    .help('h')
    .alias('h', 'help')
    .parse()
