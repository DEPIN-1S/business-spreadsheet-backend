import { DataTypes } from 'sequelize';
import sequelize from '../../config/db.js';
import User from '../user/user.model.js';

export const FreelanceBusiness = sequelize.define('FreelanceBusiness', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, references: { model: User, key: 'id' } },
    name: { type: DataTypes.STRING, allowNull: false }
});

export const FreelanceParty = sequelize.define('FreelanceParty', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, references: { model: User, key: 'id' } },
    businessId: { type: DataTypes.UUID, allowNull: false, references: { model: FreelanceBusiness, key: 'id' } },
    name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, defaultValue: 'party' },
    customFields: { type: DataTypes.JSON, allowNull: true }
});

export const FreelanceTemplate = sequelize.define('FreelanceTemplate', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, references: { model: User, key: 'id' } },
    templateName: { type: DataTypes.STRING, allowNull: true },
    columns: { type: DataTypes.JSON, allowNull: true },
    fromDetails: { type: DataTypes.JSON, allowNull: true },
    toDetails: { type: DataTypes.JSON, allowNull: true },
    logo: { type: DataTypes.TEXT, allowNull: true },
    paymentModes: { type: DataTypes.JSON, allowNull: true },
    sealImage: { type: DataTypes.TEXT, allowNull: true },
    signatureImage: { type: DataTypes.TEXT, allowNull: true },
    layout: { type: DataTypes.JSON, allowNull: true }
});

export const FreelanceInvoice = sequelize.define('FreelanceInvoice', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, references: { model: User, key: 'id' } },
    businessId: { type: DataTypes.UUID, allowNull: true, references: { model: FreelanceBusiness, key: 'id' } },
    invoiceNo: { type: DataTypes.STRING, allowNull: true },
    date: { type: DataTypes.STRING, allowNull: true },
    clientName: { type: DataTypes.STRING, allowNull: true },
    templateName: { type: DataTypes.STRING, allowNull: true },
    grandTotal: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    items: { type: DataTypes.JSON, allowNull: true },
    totals: { type: DataTypes.JSON, allowNull: true },
    template: { type: DataTypes.JSON, allowNull: true }
});

User.hasMany(FreelanceBusiness, { foreignKey: 'userId', as: 'freelanceBusinesses' });
FreelanceBusiness.belongsTo(User, { foreignKey: 'userId', as: 'user' });

FreelanceBusiness.hasMany(FreelanceParty, { foreignKey: 'businessId', as: 'parties', onDelete: 'CASCADE' });
FreelanceParty.belongsTo(FreelanceBusiness, { foreignKey: 'businessId', as: 'business' });

User.hasMany(FreelanceParty, { foreignKey: 'userId', as: 'freelanceParties' });
FreelanceParty.belongsTo(User, { foreignKey: 'userId', as: 'user' });

FreelanceBusiness.hasMany(FreelanceInvoice, { foreignKey: 'businessId', as: 'invoices', onDelete: 'CASCADE' });
FreelanceInvoice.belongsTo(FreelanceBusiness, { foreignKey: 'businessId', as: 'business' });

User.hasMany(FreelanceTemplate, { foreignKey: 'userId', as: 'freelanceTemplates' });
FreelanceTemplate.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(FreelanceInvoice, { foreignKey: 'userId', as: 'freelanceInvoices' });
FreelanceInvoice.belongsTo(User, { foreignKey: 'userId', as: 'user' });
