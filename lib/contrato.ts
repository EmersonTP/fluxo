// Gerador do Contrato de Adesão da Emerson Saúde (HTML pronto para impressão/PDF).
// O texto-base das cláusulas é o modelo institucional da Emerson; os campos do paciente
// e do Anexo I (plano, valor, vencimento) são preenchidos a partir do cadastro.

export type ContratoData = {
  nome: string;
  cpf?: string | null;
  rg?: string | null;
  endereco?: string | null;        // endereço completo em uma linha
  plano?: string | null;
  valorMensal?: number | null;     // em reais
  diaCobranca?: number | null;
  formaPagamento?: string | null;  // Cartão | PIX | Boleto
  dataInicio?: string | null;      // dd/mm/aaaa
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
const money = (v?: number | null) => (v == null ? "____________" : "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const formaMark = (f: string, sel?: string | null) => ((sel || "").toLowerCase().includes(f.toLowerCase()) ? "(X)" : "( )");

export function contratoHtml(d: ContratoData): string {
  const blank = "________________________";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Contrato de Adesão — Emerson Saúde — ${esc(d.nome)}</title>
<style>
  @page { size: A4; margin: 22mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; font-size: 11.5pt; line-height: 1.5; max-width: 760px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 15pt; text-align: center; margin: 0 0 2px; }
  h2 { font-size: 12pt; text-align: center; font-weight: normal; color: #444; margin: 0 0 2px; }
  h3 { font-size: 11.5pt; margin: 18px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  .sub { text-align: center; color: #666; font-size: 10pt; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10.5pt; }
  td { border: 1px solid #bbb; padding: 6px 9px; vertical-align: top; }
  td.k { background: #f4f4f6; font-weight: bold; width: 32%; }
  p { margin: 6px 0; text-align: justify; }
  ol.parts { margin: 4px 0 4px 18px; } ol.parts li { margin: 3px 0; }
  .assinaturas { margin-top: 34px; display: flex; gap: 40px; }
  .assinaturas .col { flex: 1; text-align: center; }
  .linha { border-top: 1px solid #333; margin-top: 40px; padding-top: 4px; font-size: 10pt; }
  .noprint { background: #eef; border: 1px solid #99c; border-radius: 8px; padding: 10px 14px; font-family: Arial, sans-serif; font-size: 10pt; margin-bottom: 18px; }
  @media print { .noprint { display: none; } body { padding: 0; } }
</style></head><body>
<div class="noprint"><b>Como gerar o PDF:</b> use Imprimir (Ctrl/Cmd+P) → Salvar como PDF. Envie o PDF ao paciente para assinatura via gov.br (assinador.iti.gov.br). O assinado volta para o cofre de documentos do paciente.</div>

<h1>EMERSON SAÚDE — Clínica Médica Digital</h1>
<h2>Contrato de Adesão a Serviços de Saúde Digital</h2>
<div class="sub">Tratamento de Transtornos por Uso de Substâncias e Comportamentos Compulsivos</div>

<h3>Identificação das Partes</h3>
<p><b>CONTRATADA:</b></p>
<table>
  <tr><td class="k">Razão Social</td><td>Emerson Healthtech Serviços Ltda - EPP</td></tr>
  <tr><td class="k">CNPJ</td><td>64.127.021/0001-55</td></tr>
  <tr><td class="k">Endereço</td><td>Digital — Plataforma emersonhealth.com.br</td></tr>
  <tr><td class="k">Responsável</td><td>Giancarlo Gariglia — CEO</td></tr>
  <tr><td class="k">Encarregado (DPO)</td><td>Vinicius Graciano — privacidade@emersonhealth.com.br</td></tr>
</table>
<p><b>CONTRATANTE (PACIENTE OU RESPONSÁVEL LEGAL):</b></p>
<table>
  <tr><td class="k">Nome completo</td><td>${esc(d.nome) || blank}</td></tr>
  <tr><td class="k">CPF</td><td>${esc(d.cpf) || blank}</td></tr>
  <tr><td class="k">RG</td><td>${esc(d.rg) || blank}</td></tr>
  <tr><td class="k">Endereço</td><td>${esc(d.endereco) || blank}</td></tr>
</table>

<h3>Cláusula 1ª — Do Objeto</h3>
<p>O presente contrato tem por objeto a prestação de serviços de saúde digital pela CONTRATADA ao CONTRATANTE, consistindo em:</p>
<p>a. Consultas médicas e psicológicas realizadas por plataforma digital (teleconsulta), com equipe multiprofissional especializada em transtornos por uso de substâncias (álcool, drogas, apostas esportivas e jogos de azar, nicotina/vape) e comportamentos compulsivos;<br>
b. Acesso à plataforma Emerson Saúde, com funcionalidades de acompanhamento de tratamento, conteúdo psicoeducacional, técnicas de enfrentamento e comunicação com a equipe clínica;<br>
c. Plano de tratamento individualizado baseado em Terapia Cognitivo-Comportamental (TCC), Entrevista Motivacional e prevenção de recaída;<br>
d. Suporte clínico contínuo conforme modalidade de plano contratada.</p>

<h3>Cláusula 2ª — Da Modalidade, Valores, Recorrência e Pagamento</h3>
<p>2.1. Os planos disponíveis, seus valores e periodicidade constam do Anexo I deste contrato e/ou são informados ao CONTRATANTE no momento da adesão via plataforma digital, podendo ser consultados a qualquer tempo em emersonhealth.com.br. O Anexo I, quando preenchido, integra este instrumento para todos os fins.</p>
<p>2.2. O serviço é prestado em regime de recorrência mensal automática. O contrato renova-se automaticamente a cada ciclo mensal, mediante cobrança antecipada, enquanto não houver cancelamento na forma da Cláusula 6ª.</p>
<p>2.3. O pagamento será realizado por cartão de crédito, PIX ou boleto bancário, conforme opção escolhida na plataforma, com cobrança antecipada de cada ciclo mensal.</p>
<p>2.4. O valor mensal é fixo durante a vigência e será reajustado, no máximo, uma vez a cada 12 (doze) meses, com base na variação do IPCA/IBGE (ou índice substituto), mediante comunicação ao CONTRATANTE com antecedência mínima de 30 (trinta) dias.</p>
<p>2.5. A CONTRATADA poderá comunicar ao CONTRATANTE, com antecedência mínima de 14 (catorze) dias do próximo ciclo, o valor a ser cobrado na renovação seguinte. A ausência de cancelamento pelo CONTRATANTE no prazo da Cláusula 6.2 importa concordância com a renovação e a respectiva cobrança.</p>
<p>2.6. Em caso de inadimplemento, o acesso à plataforma e aos serviços poderá ser suspenso após notificação prévia de 5 (cinco) dias, sem prejuízo das cobranças devidas.</p>

<h3>Cláusula 3ª — Das Obrigações da Contratada</h3>
<p>São obrigações da EMERSON SAÚDE:</p>
<p>a. Disponibilizar equipe multiprofissional habilitada (médicos, psicólogos e demais profissionais de saúde) com registro ativo nos respectivos Conselhos de Classe;<br>
b. Manter a confidencialidade de todas as informações de saúde do CONTRATANTE, nos termos do Código de Ética Médica, do CFP e da Lei nº 13.709/2018 (LGPD);<br>
c. Empregar seus melhores esforços para assegurar a disponibilidade e o bom funcionamento da plataforma digital, ressalvadas manutenções programadas, comunicadas com antecedência sempre que possível, e fatos alheios ao seu controle;<br>
d. Emitir documentação clínica (receituários, atestados, encaminhamentos) em conformidade com a legislação vigente;<br>
e. Orientar o CONTRATANTE sobre os limites do atendimento digital e, em caso de risco grave à integridade do paciente, acionar protocolos de segurança e indicar atendimento presencial de urgência.</p>

<h3>Cláusula 4ª — Das Obrigações do Contratante</h3>
<p>São obrigações do CONTRATANTE:</p>
<p>a. Fornecer informações verdadeiras e completas sobre o histórico de saúde do paciente, medicamentos em uso e condições clínicas relevantes;<br>
b. Comparecer às consultas agendadas ou cancelá-las com antecedência mínima de 24 (vinte e quatro) horas. Consultas canceladas em prazo inferior ou não comparecidas, sem justificativa, poderão ser cobradas em 50% (cinquenta por cento) do valor da sessão, ressalvada tolerância na primeira ocorrência;<br>
c. Utilizar os serviços exclusivamente para fins terapêuticos e pessoais, sendo vedada a cessão de acesso a terceiros;<br>
d. Comunicar imediatamente à equipe clínica qualquer situação de risco ou crise que demande atendimento de urgência;<br>
e. Manter o sigilo das credenciais de acesso à plataforma, sendo responsável por qualquer uso indevido decorrente de negligência na guarda dessas informações;<br>
f. Realizar os pagamentos nas datas acordadas e manter os dados cadastrais e de cobrança atualizados.</p>

<h3>Cláusula 5ª — Da Proteção de Dados e Confidencialidade</h3>
<p>5.1. A CONTRATADA tratará os dados pessoais e de saúde do CONTRATANTE nos termos da Lei nº 13.709/2018 (LGPD), com base legal na execução de contrato (art. 7º, V) e na tutela da saúde (art. 11, II, 'f').</p>
<p>5.2. Os dados de saúde serão utilizados exclusivamente para: (i) prestação dos serviços contratados; (ii) elaboração e acompanhamento do plano de tratamento; (iii) cumprimento de obrigações legais e regulatórias.</p>
<p>5.3. Os dados não serão compartilhados com terceiros para fins comerciais. O compartilhamento com outros profissionais de saúde ocorrerá apenas mediante autorização expressa do CONTRATANTE ou por determinação legal.</p>
<p>5.4. Os dados são tratados de forma confidencial e, sempre que utilizados para fins estatísticos, de pesquisa, melhoria do serviço ou geração de indicadores, são anonimizados ou pseudonimizados, de modo a não permitir a identificação do paciente.</p>
<p>5.5. O CONTRATANTE poderá, a qualquer tempo, solicitar acesso, correção, portabilidade ou eliminação de seus dados, nos termos da LGPD, pelo e-mail privacidade@emersonhealth.com.br. A eliminação não alcança os dados cuja guarda seja exigida por obrigação legal ou regulatória — em especial o prontuário médico, que será conservado pelo prazo mínimo de 20 (vinte) anos previsto na legislação aplicável (Resolução CFM nº 1.821/2007 e normas correlatas).</p>
<p>5.6. As sessões e conteúdos produzidos no âmbito do tratamento são protegidos pelo sigilo profissional e não poderão ser gravados, reproduzidos ou divulgados pelo CONTRATANTE sem autorização formal por escrito.</p>
<p>5.7. O CONTRATANTE autoriza expressamente que o plano de ação definido nas sessões com a psicóloga seja compartilhado, internamente, com a equipe de experiência do paciente da Emerson, exclusivamente para fins de acompanhamento, continuidade e qualidade do cuidado. Esse compartilhamento restringe-se ao plano de ação e às orientações necessárias ao acompanhamento, não abrangendo o conteúdo integral das sessões, e a equipe de experiência do paciente está igualmente sujeita ao dever de confidencialidade e sigilo.</p>

<h3>Cláusula 6ª — Do Prazo, Renovação e Rescisão</h3>
<p>6.1. O contrato entra em vigor na data de adesão à plataforma e renova-se automaticamente, mês a mês, enquanto houver plano ativo, conforme a Cláusula 2ª.</p>
<p>6.2. O CONTRATANTE poderá cancelar o contrato a qualquer tempo, mediante comunicação com antecedência mínima de 14 (catorze) dias do início do próximo ciclo mensal. O cancelamento solicitado dentro dos 14 (catorze) dias anteriores à renovação produzirá efeitos somente a partir do ciclo subsequente, permanecendo válida a cobrança do ciclo já iniciado.</p>
<p>6.3. O ciclo mensal em curso, já cobrado, não é reembolsável, permanecendo o CONTRATANTE com acesso integral aos serviços até o término do respectivo ciclo.</p>
<p>6.4. O cancelamento poderá ser solicitado pelo mesmo meio utilizado na contratação, bem como pelos canais de atendimento da CONTRATADA, garantida a confirmação do recebimento da solicitação.</p>
<p>6.5. A CONTRATADA poderá rescindir o contrato nas hipóteses de: (i) inadimplemento superior a 30 (trinta) dias; (ii) uso indevido da plataforma; (iii) fornecimento de informações falsas que comprometam o tratamento ou a segurança da equipe clínica. Nas hipóteses (ii) e (iii), não haverá reembolso do ciclo em curso.</p>

<h3>Cláusula 7ª — Das Limitações do Serviço Digital</h3>
<p>7.1. O atendimento é prestado exclusivamente por meio digital (teleconsulta), em conformidade com as resoluções do CFM e do CFP que regulamentam a telemedicina e o teleatendimento psicológico.</p>
<p>7.2. O serviço NÃO substitui atendimento presencial em situações de urgência e emergência. Em caso de risco imediato à vida, o CONTRATANTE deve acionar o SAMU (192), o pronto-socorro mais próximo ou, em situações de sofrimento emocional grave, o Centro de Valorização da Vida — CVV (188).</p>
<p>7.3. A CONTRATADA não se responsabiliza por falhas de conectividade no lado do CONTRATANTE ou por interrupções no serviço de telecomunicação do usuário.</p>

<h3>Cláusula 8ª — Do Foro e Legislação Aplicável</h3>
<p>8.1. As partes elegem o foro da comarca de domicílio do CONTRATANTE para dirimir controvérsias, sem prejuízo de resolução extrajudicial por mediação ou plataformas de consumo (PROCON, consumidor.gov.br).</p>
<p>8.2. Este contrato é regido pelas leis brasileiras, em especial o Código de Defesa do Consumidor (Lei nº 8.078/1990), o Código Civil (Lei nº 10.406/2002), a Lei nº 13.709/2018 (LGPD) e a legislação sanitária vigente.</p>

<h3>Declaração de Ciência e Anuência</h3>
<p>Ao assinar este instrumento, o CONTRATANTE declara ter lido integralmente, compreendido e concordado com todas as cláusulas e condições aqui dispostas — em especial o regime de recorrência mensal automática e as condições de cancelamento da Cláusula 6ª — bem como com a Política de Privacidade e os Termos de Uso da plataforma Emerson Saúde, disponíveis em emersonhealth.com.br.</p>
<p>Local e data: ${blank}, ______ de ________________ de ________.</p>

<div class="assinaturas">
  <div class="col"><div class="linha">Giancarlo Gariglia<br>CEO — Emerson Saúde<br>emersonhealth.com.br</div></div>
  <div class="col"><div class="linha">${esc(d.nome) || "PACIENTE / RESPONSÁVEL"}<br>CPF: ${esc(d.cpf) || "____________"}</div></div>
</div>

<h3>Anexo I — Plano Contratado</h3>
<p>Este anexo integra o Contrato de Adesão e detalha o plano, o valor mensal e a forma de pagamento aplicáveis ao CONTRATANTE.</p>
<table>
  <tr><td class="k">Plano</td><td>${esc(d.plano) || blank}</td></tr>
  <tr><td class="k">Valor mensal</td><td>${money(d.valorMensal)}</td></tr>
  <tr><td class="k">Forma de pagamento</td><td>${formaMark("cart", d.formaPagamento)} Cartão&nbsp;&nbsp; ${formaMark("pix", d.formaPagamento)} PIX&nbsp;&nbsp; ${formaMark("bol", d.formaPagamento)} Boleto</td></tr>
  <tr><td class="k">Dia de cobrança</td><td>${d.diaCobranca ? esc(d.diaCobranca) : "______"} de cada mês (recorrência automática)</td></tr>
  <tr><td class="k">Data de início</td><td>${esc(d.dataInicio) || blank}</td></tr>
</table>
</body></html>`;
}
