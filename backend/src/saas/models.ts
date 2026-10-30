import { DataTypes, Model, Sequelize } from 'sequelize';

export type Role = 'owner' | 'admin' | 'member';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

export class Plan extends Model {
  declare id: string;
  declare code: string;
  declare name: string;
  declare maxMembers: number;
  declare maxWorlds: number;
  declare priceCents: number;
}

export class Tenant extends Model {
  declare id: string;
  declare slug: string;
  declare name: string;
}

export class User extends Model {
  declare id: string;
  declare tenantId: string;
  declare firebaseUid: string;
  declare email: string;
  declare role: Role;
}

export class Subscription extends Model {
  declare id: string;
  declare tenantId: string;
  declare planId: string;
  declare status: SubscriptionStatus;
  declare currentPeriodEnd: Date | null;
}

export function createSequelize(url: string): Sequelize {
  return new Sequelize(url, { dialect: 'postgres', logging: false, define: { underscored: true } });
}

/** Binds the models to a connection. The table definitions mirror saas-migrations. */
export function initModels(sequelize: Sequelize) {
  const id = { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 };

  Plan.init(
    {
      id,
      code: { type: DataTypes.STRING(32), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(80), allowNull: false },
      maxMembers: { type: DataTypes.INTEGER, allowNull: false },
      maxWorlds: { type: DataTypes.INTEGER, allowNull: false },
      priceCents: { type: DataTypes.INTEGER, allowNull: false },
    },
    { sequelize, tableName: 'plans' },
  );
  Tenant.init(
    {
      id,
      slug: { type: DataTypes.STRING(48), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
    },
    { sequelize, tableName: 'tenants' },
  );
  User.init(
    {
      id,
      tenantId: { type: DataTypes.UUID, allowNull: false },
      firebaseUid: { type: DataTypes.STRING(128), allowNull: false },
      email: { type: DataTypes.STRING(254), allowNull: false },
      role: { type: DataTypes.STRING(16), allowNull: false },
    },
    { sequelize, tableName: 'users' },
  );
  Subscription.init(
    {
      id,
      tenantId: { type: DataTypes.UUID, allowNull: false, unique: true },
      planId: { type: DataTypes.UUID, allowNull: false },
      status: { type: DataTypes.STRING(16), allowNull: false },
      currentPeriodEnd: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: 'subscriptions' },
  );

  Tenant.hasMany(User, { foreignKey: 'tenantId', onDelete: 'CASCADE' });
  User.belongsTo(Tenant, { foreignKey: 'tenantId' });
  Tenant.hasOne(Subscription, { foreignKey: 'tenantId', onDelete: 'CASCADE' });
  Subscription.belongsTo(Tenant, { foreignKey: 'tenantId' });
  Plan.hasMany(Subscription, { foreignKey: 'planId' });
  Subscription.belongsTo(Plan, { foreignKey: 'planId' });

  return { sequelize, Plan, Tenant, User, Subscription };
}

export type Models = ReturnType<typeof initModels>;
