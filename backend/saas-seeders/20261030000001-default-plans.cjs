'use strict';

const plans = [
  { code: 'free', name: 'Free', max_members: 3, max_worlds: 1, price_cents: 0 },
  { code: 'pro', name: 'Pro', max_members: 15, max_worlds: 10, price_cents: 2900 },
  { code: 'scale', name: 'Scale', max_members: 100, max_worlds: 100, price_cents: 14900 },
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('plans', plans);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('plans', { code: plans.map((p) => p.code) });
  },
};
