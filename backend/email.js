require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function enviarCodigoRecuperacao(email, codigo) {
  await transporter.sendMail({
    from: `"ReviraApp" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Recuperação de senha - ReviraApp',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #2E7D32; margin-bottom: 4px;">ReviraApp</h2>
        <p style="color: #333;">Você solicitou a recuperação da sua senha.</p>
        <p style="color: #333;">Use o código abaixo no app. Ele expira em <strong>15 minutos</strong>:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #1B5E20; background: #E8F5E9; padding: 16px; text-align: center; border-radius: 10px; margin: 20px 0;">
          ${codigo}
        </div>
        <p style="color: #999; font-size: 12px;">Se você não solicitou essa recuperação, pode ignorar este e-mail com segurança.</p>
      </div>
    `,
  });
}

async function enviarCupomRecompensa(emailDestino, nomeRecompensa, codigoCupom) {
  await transporter.sendMail({
    from: `"ReviraApp" <${process.env.EMAIL_USER}>`,
    to: emailDestino,
    subject: `🎁 O seu cupão para: ${nomeRecompensa}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #2E7D32; margin-bottom: 4px;">ReviraApp - Recompensa Resgatada!</h2>
        <p style="color: #333;">Parabéns! Usou os seus EcoPontos para resgatar: <strong>${nomeRecompensa}</strong></p>
        <p style="color: #333;">O seu código promocional exclusivo é:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1B5E20; background: #E8F5E9; padding: 16px; text-align: center; border-radius: 10px; margin: 20px 0;">
          ${codigoCupom}
        </div>
        <p style="color: #333;">Apresente este código à empresa parceira para aproveitar a sua recompensa.</p>
        <p style="color: #999; font-size: 12px;">Continue a reciclar e a salvar o planeta!</p>
      </div>
    `,
  });
}

module.exports = { enviarCodigoRecuperacao, enviarCupomRecompensa };