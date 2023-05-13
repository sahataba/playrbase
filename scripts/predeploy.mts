import { migrateDatabase, MigrationEnvironment } from './_migratetool.mjs';

console.log(JSON.stringify(process.env, null, 2));

if (
    !process.env.SURREAL_HOST ||
    !process.env.SURREAL_USERNAME ||
    !process.env.SURREAL_PASSWORD ||
    !process.env.SURREAL_NAMESPACE ||
    !process.env.SURREAL_DATABASE
) {
    console.error('One or more environment variables are missing');
    process.exit(1);
}

migrateDatabase(process.env as unknown as MigrationEnvironment);
