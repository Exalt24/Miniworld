'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tenants', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      slug: { type: Sequelize.STRING(48), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(120), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tenants');
  },
};
