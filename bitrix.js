import "dotenv/config.js";
import axios from "axios";

const api = axios.create({
  baseURL: process.env.BITRIX_WEBHOOK,
});


// 🔎 Listar todos os pipelines
async function listarPipelines() {
  try {

    const res = await api.get("crm.dealcategory.list");
    const pipelines = res.data.result;

    console.log("📋 Pipelines disponíveis:");
    console.log(res.data)
    pipelines.forEach(p => {
      console.log(`- ${p.NAME} (CATEGORY_ID = ${p.ID})`);
    });

    return pipelines;
  } catch (err) {
    console.error(`📄 [${new Date().toLocaleTimeString()}] Erro ao listar pipelines:`, err.response?.data || err.message);
  }
}

async function listarNegocios(pipeline) {
  console.log(`📄 [${new Date().toLocaleTimeString()}] 🔍 Consultando negócios no pipeline ${pipeline} ...`);
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  let start = 0;
  let total = 0;
  const todosNegocios = [];
  
  do {
    try {
      const res = await api.get("crm.deal.list", {
        params: {
          filter: { 
            CATEGORY_ID: pipeline,
            '!STAGE_SEMANTIC_ID': ['S', 'F']
          },
          select: ["ID", "TITLE", "STAGE_ID", "STAGE_SEMANTIC_ID", "CATEGORY_ID"],
          start: start // ✅ Adiciona paginação
        },
      });

      const negocios = res.data.result;
      todosNegocios.push(...negocios);
      
      // Atualiza para a próxima página
      start += negocios.length;
      total = res.data.total;
      console.log(`📄 [${new Date().toLocaleTimeString()}] Página carregada: ${start} de ${total} negócios processados. Pipeline ${pipeline}`);
      
      await delay(1000);
      
    } catch (err) {
      console.error(`📄 [${new Date().toLocaleTimeString()}] Erro ao listar negócios:`, err.response?.data || err.message);
      break;
    }
  } while (start < total); // Continua enquanto houver mais registros

  console.log(`📄 [${new Date().toLocaleTimeString()}] Total de negócios encontrados: ${todosNegocios.length}`);
  return todosNegocios;
}

  


// Adicionar comentário na linha do tempo
async function adicionarComentario(id, texto) {
  console.log(`📄 [${new Date().toLocaleTimeString()}] Adicionando comentário ao negócio ${id} ...`);
  await api.post("crm.timeline.comment.add", {
    fields: {
      ENTITY_ID: id,
      ENTITY_TYPE: "deal",
      COMMENT: texto,
    },
  });
}

// Atualizar negócio no Bitrix24
async function atualizarNegocio(negocioId, campos) {
  try {
    console.log(`📄 [${new Date().toLocaleTimeString()}] Atualizando negócio ${negocioId} ...`);
    
    const res = await api.post("crm.deal.update", {
      id: negocioId,
      fields: campos,
    });

    if (res.data.result === true) {
      console.log(`✅ [${new Date().toLocaleTimeString()}] Negócio ${negocioId} atualizado com sucesso!`);
      return true;
    } else {
      console.warn(`⚠️ [${new Date().toLocaleTimeString()}] Não foi possível atualizar negócio ${negocioId}`, res.data);
      return false;
    }
  } catch (err) {
    console.error(`❌ [${new Date().toLocaleTimeString()}] Erro ao atualizar negócio ${negocioId}:`, err.response?.data || err.message);
    return false;
  }
}



export { listarPipelines, listarNegocios, adicionarComentario, atualizarNegocio };