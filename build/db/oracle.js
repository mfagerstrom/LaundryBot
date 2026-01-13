import oracledb from "oracledb";
function getOracleConfig() {
    const user = process.env.ORACLE_USER;
    const password = process.env.ORACLE_PASSWORD;
    const connectString = process.env.ORACLE_CONNECT_STRING;
    if (!user || !password || !connectString) {
        throw new Error("Missing Oracle config. Set ORACLE_USER, ORACLE_PASSWORD, and ORACLE_CONNECT_STRING.");
    }
    return { user, password, connectString };
}
export async function withOracleConnection(handler) {
    const connection = await oracledb.getConnection(getOracleConfig());
    try {
        return await handler(connection);
    }
    finally {
        await connection.close();
    }
}
