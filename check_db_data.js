import sequelize from "./src/config/db.js";

async function checkData() {
    try {
        const [results] = await sequelize.query("SELECT id, name, options FROM columns");
        console.log("Data in 'columns' table (options field):");
        results.forEach(res => {
            console.log(`- ID: ${res.id}, Name: ${res.name}, Options Type: ${typeof res.options}, Options: ${JSON.stringify(res.options)}`);
            try {
                if (typeof res.options === 'string') {
                    JSON.parse(res.options);
                }
            } catch (e) {
                console.error(`  !!! INVALID JSON in options for column ${res.name} (ID: ${res.id})`);
            }
        });
    } catch (err) {
        console.error("Error querying data:", err);
    } finally {
        await sequelize.close();
    }
}

checkData();
