// Based on example from https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/#logging-errors-with-pino

import pino from 'pino';

const transport = pino.transport({
    targets: [
        {
            target: 'pino/file',
            options: {destination: `${process.cwd()}/app.log`},
        },
        {
            target: 'pino/file', // logs to the standard output by default
        },
    ],
});

const logger = pino(
    {
        level: process.env.PINO_LOG_LEVEL || 'info',
        timestamp: pino.stdTimeFunctions.isoTime,
    },
    transport
);

export default logger;
