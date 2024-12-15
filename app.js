require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');
const winston = require('winston');

// Настройка логирования
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`)
    ),
    transports: [new winston.transports.Console()]
});

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// Утилита для загрузки файла
const downloadFile = async (url) => {
    try {
        logger.info(`Скачивание файла: ${url}`);
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer'
        });
        return { data: response.data, fileName: path.basename(url) };
    } catch (error) {
        logger.error(`Ошибка при скачивании файла (${url}): ${error.message}`);
        throw new Error(`Failed to download file from URL: ${url}`);
    }
};

// Генерация PDF с водяными знаками через Puppeteer
const generatePDFWithWatermarks = async (htmlContent) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Загружаем HTML с водяными знаками
    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
    });

    await browser.close();
    return pdfBuffer;
};

// Основной эндпоинт
app.post('/generate-pdf', async (req, res) => {
    logger.info(`Запрос на генерацию PDF получен`);
    try {
        const { urls, signatures } = req.body;

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            logger.warn(`Не указаны ссылки для загрузки`);
            return res.status(400).send('No URLs provided.');
        }

        if (!signatures || !Array.isArray(signatures) || signatures.length === 0) {
            logger.warn(`Не указаны данные для подписей`);
            return res.status(400).send('No signature information provided.');
        }

        // Создание HTML с водяными знаками
        const htmlContent = `
            <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                        }
                        .watermark {
                            position: absolute;
                            top: 20%;
                            left: 50%;
                            transform: translateX(-50%);
                            font-size: 14px;
                            color: rgba(0, 0, 0, 0.3);
                            text-align: center;
                            font-weight: bold;
                        }
                    </style>
                </head>
                <body>
                    <div class="watermark">
                        DOCUMENT SIGNED WITH A QUALIFIED ELECTRONIC SIGNATURE<br>
                        Certificate Number: ${signatures[0].certificateNumber}<br>
                        Certificate Owner: ${signatures[0].owner}<br>
                        Validity: ${signatures[0].validity}
                    </div>
                    <div class="watermark">
                        DOCUMENT SIGNED WITH A QUALIFIED ELECTRONIC SIGNATURE<br>
                        Certificate Number: ${signatures[1].certificateNumber}<br>
                        Certificate Owner: ${signatures[1].owner}<br>
                        Validity: ${signatures[1].validity}
                    </div>
                </body>
            </html>
        `;

        // Генерация PDF
        const pdfBuffer = await generatePDFWithWatermarks(htmlContent);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=merged.pdf');
        res.send(pdfBuffer);

        logger.info(`PDF успешно сгенерирован и отправлен`);
    } catch (error) {
        logger.error(`Ошибка при обработке запроса: ${error.message}`);
        res.status(500).send('An error occurred while processing the files.');
    }
});

app.listen(PORT, () => {
    logger.info(`Сервис запущен на http://localhost:${PORT}`);
});
