'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subscriptions', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      plan_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'plans', key: 'id' } },
      status: { type: Sequelize.STRING(16), allowNull: false },
      current_period_end: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
    });
    await queryInterface.sequelize.query(
      "ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_known CHECK (status IN ('trialing', 'active', 'past_due', 'canceled'))",
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('subscriptions');
  },
};
