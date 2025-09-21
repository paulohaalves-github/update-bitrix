import mysql from "mysql2/promise";

export async function getConexao() {
  return await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}


// 🔎 Consulta os logs da ordem de serviço pelo ServiceOrder_fk
export async function consultarLogsPorNegocioDB(negocioId) {
  const conn = await getConexao();

  try {
    const [rows] = await conn.execute(
      `SELECT * 
       FROM gspn2.service_order_logs 
       WHERE ServiceOrder_fk = ?`,
      [negocioId]
    );

    return rows; // retorna todos os registros
  } catch (err) {
    console.error("Erro ao consultar logs:", err);
    return [];
  } finally {
    await conn.end();
  }
}

// 🔎 Consulta os logs da ordem de serviço pelo ServiceOrder_fk
export async function consultarServiceOrder(negocioId) {
  const conn = await getConexao();

  try {
    const [rows] = await conn.execute(
      `SELECT * 
       FROM gspn2.service_order so
       LEFT JOIN gspn2.service_order_product sop ON so.SvcOrderNo = sop.ServiceOrder_fk
       LEFT JOIN gspn2.service_order_repair_detail sord ON so.SvcOrderNo = sord.ServiceOrder_fk
       LEFT JOIN gspn2.service_order_dates sodate ON so.SvcOrderNo = sodate.ServiceOrder_fk
       WHERE SvcOrderNo = ?`,
      [negocioId]
    );

    return rows; // retorna todos os registros
  } catch (err) {
    console.error("Erro ao consultar Service Order:", err);
    return [];
  } finally {
    await conn.end();
  }
}