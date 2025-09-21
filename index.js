import { listarPipelines, listarNegocios, adicionarComentario, atualizarNegocio } from "./bitrix.js";
import { consultarLogsPorNegocioDB , consultarServiceOrder} from "./db.js";
import { 
  initDatabase, 
  getUnprocessedInteractions, 
  batchSaveInteractions,
  saveProcessedInteraction, // ADICIONE ESTA LINHA
  closeDatabase 
} from "./dbLogger.js";

// Crie a função de formatação primeiro
function formatHoraDate(dataString, horarioString) {
    // --- Formatação da Data ---
    const ano = dataString.substring(0, 4);
    const mes = dataString.substring(4, 6);
    const dia = dataString.substring(6, 8);
    const dataFormatada = `${dia}-${mes}-${ano}`;

    // --- Formatação do Horário ---
    const hora = horarioString.substring(0, 2);
    const minuto = horarioString.substring(2, 4);
    const segundo = horarioString.substring(4, 6);
    const horarioFormatado = `${hora}:${minuto}:${segundo}`;

    // Retorna um objeto com os valores formatados
    return {
      data: dataFormatada,
      horario: horarioFormatado
    };    

    // Exemplo simples de formatação
    
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function processarNegocio(negocio, index, totalNegocios) {
  console.log(`🔍 [${new Date().toLocaleTimeString()}] [${index + 1}/${totalNegocios}] Processando negócio: ${negocio.ID} - ${negocio.TITLE}`);
  //console.log(`📍 Stage: ${negocio.STAGE_ID}`);
  
  try {
    const logs = await consultarLogsPorNegocioDB(negocio.TITLE);
    const dadosServiceOrder = await consultarServiceOrder(negocio.TITLE)

    //console.log(dadosServiceOrder[0])
    //delay(220000)
    
    if (!logs || logs.length === 0) {
      console.log(`ℹ️  [${new Date().toLocaleTimeString()}] Nenhum log encontrado para o negócio ${negocio.ID}`);
      return { processado: true, novasInteracoes: 0, comentarioAdicionado: false };
    }

    // Filtrar apenas as interações não processadas
    const novasInteracoes = await getUnprocessedInteractions(logs, negocio.TITLE);
    
    console.log(`📋 [${new Date().toLocaleTimeString()}] ${novasInteracoes.length} novas interações de ${logs.length} totais para o negócio ${negocio.ID}`);
    
    if (novasInteracoes.length === 0) {
      console.log(`ℹ️  [${new Date().toLocaleTimeString()}] Nenhuma NOVA interação encontrada para o negócio ${negocio.ID}`);
      return { processado: true, novasInteracoes: 0, comentarioAdicionado: false };
    }

    let comentariosAdicionados = 0;

    // Processar cada interação individualmente
    for (const log of novasInteracoes) {
      const { data, horario } = formatHoraDate(log.ChangedDate, log.ChangedTime);
      try {
        // Salvar interação como processada
        await saveProcessedInteraction(log.SeqNo, negocio.TITLE);
        console.log(`💾 Interação ${log.SeqNo} salva como processada`);

        // Criar comentário individual para cada interação
        const comentario = 
          `Interação relacionada a este negócio no GSPN:\n\n` +
          `📅 HORA: ${data} ${horario}\n` +
          `👤 ${log.ChangedBy}\n` +
          `📝 ${log.SOComment || 'Sem comentário'}\n` +
          `🔄STATUS ATUALIZADO: ${log.StatusDesc}` +
          (log.StatusDesc ? ` (${log.StatusDesc})` : '') +
          (log.StReasonDesc ? ` - ${log.StReasonDesc}` : '');


        // Adicionar comentário no Bitrix
        await adicionarComentario(negocio.ID, comentario);
        await atualizarNegocio(negocio.ID, { 
            UF_CRM_1680639174051: log.StatusDesc, //STATUS GSPN
            UF_CRM_1680639212543: log.StReasonDesc || '', //SUBSTATUS 
            UF_CRM_1660052193196: dadosServiceOrder[0].AscJobNo, //AscJobNo,
            UF_CRM_1681404085821: dadosServiceOrder[0].SvcTypeDesc, //SvcTypeDesc
            UF_CRM_1673291990279: dadosServiceOrder[0].WarrantyType, //WarrantyType
            UF_CRM_1686920928650: dadosServiceOrder[0].SvcProduct, //SvcProduct
            UF_CRM_1681398126573: dadosServiceOrder[0].IrisRepair, //IrisRepair
            UF_CRM_1708614200:  dadosServiceOrder[0].WtyException, //WtyException
            UF_CRM_1684698445352: dadosServiceOrder[0].CompleteDate, // CompleteDate
            UF_CRM_1660054500483: dadosServiceOrder[0].Model_fk, // sop.Model_fk
            UF_CRM_1659970291499: dadosServiceOrder[0].SerialNo, // sop.SerialNo
            UF_CRM_1757086865667: dadosServiceOrder[0].DefectDesc // Descrição do defeito - Campo comentário bitrix
        });
        comentariosAdicionados++;
        
        console.log(`💬 [${new Date().toLocaleTimeString()}] Comentário adicionado para interação ${log.SeqNo}`);
        
        // Pequeno delay entre comentários para não sobrecarregar a API
        await delay(1000);
        
      } catch (error) {
        console.error(`❌ Erro ao processar interação ${log.SeqNo}:`, error.message);
      }
    }
    
    return { 
      processado: true, 
      novasInteracoes: novasInteracoes.length, 
      comentarioAdicionado: comentariosAdicionados > 0 
    };

  } catch (error) {
    console.error(`❌ [${new Date().toLocaleTimeString()}] Erro ao processar negócio ${negocio.ID}:`, error.message);
    return { processado: false, novasInteracoes: 0, comentarioAdicionado: false, error: error.message };
  }
}

async function executar() {
  let db = null;
  const startTime = new Date();
  
  try {
    console.log(`🚀 [${startTime.toLocaleTimeString()}] Iniciando processamento...`);
    
    db = await initDatabase();
    await listarPipelines();
    
    const listaDePipelines = [34,24, 26, 47, 32, 45,47,49,89,91,97,99]; // IDs dos pipelines a serem processados
    const estatisticas = {
      totalNegocios: 0,
      negociosProcessados: 0,
      totalInteracoes: 0,
      novasInteracoes: 0,
      comentariosAdicionados: 0,
      erros: 0
    };

    for (const pipeline of listaDePipelines) {
      console.log(`📊 [${new Date().toLocaleTimeString()}] Processando pipeline: ${pipeline}`);
      
      const negocios = await listarNegocios(pipeline);
      console.log(`✅ [${new Date().toLocaleTimeString()}] Encontrados ${negocios.length} negócios no pipeline ${pipeline}`);
      
      estatisticas.totalNegocios += negocios.length;
      //await delay(1000);
      
      for (let i = 0; i < negocios.length; i++) {
        const negocio = negocios[i];
        const resultado = await processarNegocio(negocio, i, negocios.length);
        
        estatisticas.negociosProcessados++;
        estatisticas.novasInteracoes += resultado.novasInteracoes || 0;
        if (resultado.comentarioAdicionado) estatisticas.comentariosAdicionados++;
        if (!resultado.processado) estatisticas.erros++;
        
        // Aguarda 2 segundos entre negócios (apenas se não for o último)
        if (i < negocios.length - 1) {
          await delay(0);
        }
      }
    }
    
    const endTime = new Date();
    const tempoExecucao = (endTime - startTime) / 1000;
    
    console.log(`\n🎉 [${endTime.toLocaleTimeString()}] Processamento concluído em ${tempoExecucao.toFixed(2)} segundos!`);
    console.log(`📊 Estatísticas:`);
    console.log(`   • Negócios processados: ${estatisticas.negociosProcessados}/${estatisticas.totalNegocios}`);
    console.log(`   • Novas interações: ${estatisticas.novasInteracoes}`);
    console.log(`   • Comentários adicionados: ${estatisticas.comentariosAdicionados}`);
    console.log(`   • Erros: ${estatisticas.erros}`);

    
    // Executa a função principal novamente
    executar().catch(error => {
      console.error('💥 Erro na execução:', error.message);
      process.exit(1);
    });  
    
  } catch (error) {
    console.error(`💥 [${new Date().toLocaleTimeString()}] Erro no processamento principal:`, error.message);
  } finally {
    if (db) {
      await closeDatabase();
    }
  }
}

// Handler de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Rejeição não tratada em:', promise, 'razão:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Exceção não capturada:', error);
  process.exit(1);
});

// Executa a função principal
executar().catch(error => {
  console.error('💥 Erro na execução:', error.message);
  process.exit(1);
});