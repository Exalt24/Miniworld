'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('plans', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      code: { type: Sequelize.STRING(32), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(80), allowNull: false },
      max_members: { type: Sequelize.INTEGER, allowNull: false },
      max_worlds: { type: Sequelize.INTEGER, allowNull: false },
      price_cents: { type: Sequelize.INTEGER, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE plans ADD CONSTRAINT plans_limits_nonnegative CHECK (max_members >= 1 AND max_worlds >= 0 AND price_cents >= 0)',
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('plans');
  },
};
