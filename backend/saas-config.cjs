// Connection settings for sequelize-cli. The URL always comes from the environment.
const base = { use_env_variable: 'SAAS_DATABASE_URL', dialect: 'postgres', logging: false };

module.exports = { development: base, test: base, production: base };
