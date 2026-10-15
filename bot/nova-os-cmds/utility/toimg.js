'use strict';

const {
  downloadMediaMessage
} = require('wolfsocket');

const {
  getBotName
} = require('../../lib/botname');

const {
  execFile
} = require('child_process');

const {
  promisify
} = require('util');

const fs = require('fs');
const os = require('os');
const path = require('path');

const execFileAsync = promisify(execFile);

module.exports = {
  name: 'toimg',

  aliases: [
    'toimage',
    'unsticker',
    'stktoimg'
  ],

  description: 'Convert a sticker back to an image',

  category: 'utility',

  async execute(sock, msg, args, prefix, ctx) {
    const chatId = msg.key.remoteJid;
    const botName = getBotName();

    // Reaction
    try {
      await sock.sendMessage(chatId, {
        react: {
          text: '🖼️',
          key: msg.key
        }
      });
    } catch {}

    // Get quoted message
    const contextInfo =
      msg.message?.extendedTextMessage?.contextInfo;

    const quotedMessage =
      contextInfo?.quotedMessage;

    // Check if replied to a sticker
    if (!quotedMessage?.stickerMessage) {
      return await sock.sendMessage(
        chatId,
        {
          text:
`┏━━❐ *🖼️ TO IMAGE* ❐━━
┃
┃✦ *Usage:*
┃  Reply to a sticker with
┃  *${prefix}toimg*
┃
┃✦ *Aliases:*
┃  ${prefix}toimage
┃  ${prefix}unsticker
┃  ${prefix}stktoimg
┃
┗━━❐ *${botName}* ❐━━

> ⚡ Powered by NOVA-OS 🔥`
        },
        { quoted: msg }
      );
    }

    // Reconstruct quoted sticker message
    const stickerMessage = {
      key: {
        remoteJid: chatId,
        id: contextInfo.stanzaId,
        participant: contextInfo.participant,
        fromMe: false
      },
      message: quotedMessage
    };

    let stickerBuffer;

    try {
      stickerBuffer = await downloadMediaMessage(
        stickerMessage,
        'buffer',
        {}
      );
    } catch (error) {
      console.error('[TOIMG DOWNLOAD ERROR]', error);

      return await sock.sendMessage(
        chatId,
        {
          text:
`┏━━❐ *🖼️ TO IMAGE* ❐━━
┃
┃✦ *Status:* ❌ Failed
┃
┃✦ Could not download the sticker.
┃
┗━━❐ *${botName}* ❐━━

> ⚡ Powered by NOVA-OS 🔥`
        },
        { quoted: msg }
      );
    }

    if (!stickerBuffer || stickerBuffer.length === 0) {
      return await sock.sendMessage(
        chatId,
        {
          text:
`┏━━❐ *🖼️ TO IMAGE* ❐━━
┃
┃✦ *Status:* ❌ Failed
┃
┃✦ Sticker could not be downloaded.
┃
┗━━❐ *${botName}* ❐━━

> ⚡ Powered by NOVA-OS 🔥`
        },
        { quoted: msg }
      );
    }

    const timestamp = Date.now();

    const inputFile = path.join(
      os.tmpdir(),
      `toimg_in_${timestamp}.webp`
    );

    const outputFile = path.join(
      os.tmpdir(),
      `toimg_out_${timestamp}.png`
    );

    try {
      // Save sticker
      fs.writeFileSync(
        inputFile,
        stickerBuffer
      );

      // Convert WebP to PNG
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-i',
          inputFile,
          '-frames:v',
          '1',
          outputFile
        ],
        {
          timeout: 15000
        }
      );

      if (!fs.existsSync(outputFile)) {
        throw new Error(
          'FFmpeg did not create an output image'
        );
      }

      const imageBuffer =
        fs.readFileSync(outputFile);

      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error(
          'Converted image is empty'
        );
      }

      // Send converted image
      await sock.sendMessage(
        chatId,
        {
          image: imageBuffer,
          caption:
`┏━━❐ *🖼️ TO IMAGE* ❐━━
┃
┃✦ *Status:* ✅ Converted
┃
┃✦ Sticker successfully converted
┃  back to an image.
┃
┗━━❐ *${botName}* ❐━━

> ⚡ Powered by NOVA-OS 🔥`
        },
        { quoted: msg }
      );

    } catch (error) {
      console.error('[TOIMG CONVERSION ERROR]', error);

      let reason =
        'Unable to convert the sticker.';

      if (
        error.code === 'ENOENT' ||
        String(error.message)
          .toLowerCase()
          .includes('ffmpeg')
      ) {
        reason =
          'FFmpeg is not installed or unavailable on the server.';
      }

      await sock.sendMessage(
        chatId,
        {
          text:
`┏━━❐ *🖼️ TO IMAGE* ❐━━
┃
┃✦ *Status:* ❌ Failed
┃
┃✦ ${reason}
┃
┗━━❐ *${botName}* ❐━━

> ⚡ Powered by NOVA-OS 🔥`
        },
        { quoted: msg }
      );

    } finally {
      // Clean temporary files
      try {
        if (fs.existsSync(inputFile)) {
          fs.unlinkSync(inputFile);
        }
      } catch {}

      try {
        if (fs.existsSync(outputFile)) {
          fs.unlinkSync(outputFile);
        }
      } catch {}
    }
  }
};
