const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

const options = {
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime
};

if (!isProduction) {
    options.transport = {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    };
}

module.exports = pino(options);
