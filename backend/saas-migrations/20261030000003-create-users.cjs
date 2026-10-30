'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      firebase_uid: { type: Sequelize.STRING(128), allowNull: false },
      email: { type: Sequelize.STRING(254), allowNull: false },
      role: { type: Sequelize.STRING(16), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
    });
    await queryInterface.sequelize.query(
      "ALTER TABLE users ADD CONSTRAINT users_role_known CHECK (role IN ('owner', 'admin', 'member'))",
    );
    // One person can belong to several tenants, but only once to each.
    await queryInterface.addIndex('users', ['tenant_id', 'firebase_uid'], { unique: true, name: 'users_tenant_uid_unique' });
    await queryInterface.addIndex('users', ['firebase_uid'], { name: 'users_firebase_uid_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
