// api/index.js
import fetch from "node-fetch";
import axios from "axios";
import * as cheerio from "cheerio";

// ───────────────────────────────
// YOUTUBE MP3
// ───────────────────────────────
async function ytMp3(url) {
  const videoId = extractYouTubeID(url);
  if (!videoId) throw new Error("Link YouTube tidak valid.");

  const headers = {
    "accept-encoding": "gzip, deflate, br, zstd",
    origin: "https://ht.flvto.online",
    "Content-Type": "application/json",
  };

  const body = JSON.stringify({
    id: videoId,
    fileType: "mp3",
  });

  const response = await fetch("https://ht.flvto.online/converter", {
    method: "POST",
    headers,
    body,
  });

  const data = await response.json();
  if (data?.status !== "ok" || !data.link) throw new Error("Gagal mengambil audio.");

  return {
    status: true,
    type: "ytmp3",
    title: data.title,
    duration: data.duration,
    size: (data.filesize / 1024 / 1024).toFixed(2) + " MB",
    link: data.link,
  };
}

function extractYouTubeID(url) {
  const regex =
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match?.[1];
}

// ───────────────────────────────
// YOUTUBE MP4
// ───────────────────────────────
async function ytMp4(url) {
  const headers = {
    "accept": "*/*",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://id.ytmp3.mobi/",
  };

  const init = await fetch(
    `https://d.ymcdn.org/api/v1/init?p=y&23=1llum1n471&_=${Math.random()}`,
    { headers }
  ).then((res) => res.json());

  const id = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/|.*embed\/))([^&?/]+)/
  )?.[1];
  if (!id) throw new Error("Link YouTube tidak valid.");

  let convertURL = `${init.convertURL}&v=${id}&f=mp4&_=${Math.random()}`;
  const convert = await fetch(convertURL, { headers }).then((res) => res.json());

  let info = {};
  for (let i = 0; i < 3; i++) {
    let j = await fetch(convert.progressURL, { headers });
    info = await j.json();
    if (info.progress == 3) break;
    await new Promise((res) => setTimeout(res, 1500));
  }

  if (!convert.downloadURL) throw new Error("Gagal mengambil link unduhan");

  return {
    status: true,
    type: "ytmp4",
    title: convert.title || "Video",
    link: convert.downloadURL,
  };
}

// ───────────────────────────────
// TIKTOK DOWNLOADER
// ───────────────────────────────
async function tiktokDownloader(url) {
  const res = await axios.post(
    "https://www.tikwm.com/api/",
    {},
    {
      headers: {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
      },
      params: { url, web: 1, hd: 1 },
    }
  );

  const data = res.data.data;
  if (!data) throw new Error("Gagal mengambil data TikTok");

  return {
    status: true,
    type: "tiktok",
    title: data.title,
    author: data.author.nickname,
    no_watermark: "https://www.tikwm.com" + data.play,
    watermark: "https://www.tikwm.com" + data.wmplay,
    music: "https://www.tikwm.com" + data.music,
    cover: "https://www.tikwm.com" + data.cover,
  };
}

// ───────────────────────────────
// INSTAGRAM DOWNLOADER
// ───────────────────────────────
async function igDownloader(url) {
  const response = await axios.post(
    "https://snapsave.app/action.php?lang=id",
    "url=" + url,
    {
      headers: {
        accept: "*/*",
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://snapsave.app",
        referer: "https://snapsave.app/id",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36",
      },
    }
  );

  const data = response.data;
  const $ = cheerio.load(data);
  const downloadLinks = [];
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (href && href.startsWith("https")) downloadLinks.push(href);
  });

  if (!downloadLinks.length) throw new Error("Gagal mengambil data Instagram");

  return {
    status: true,
    type: "instagram",
    link: downloadLinks,
  };
}

// ───────────────────────────────
// HANDLER UTAMA (API ROUTE)
// ───────────────────────────────
export default async function handler(req, res) {
  const { url, type } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Masukkan parameter ?url=" });
  }

  try {
    let result;
    switch (type) {
      case "ytmp3":
        result = await ytMp3(url);
        break;
      case "ytmp4":
        result = await ytMp4(url);
        break;
      case "tiktok":
        result = await tiktokDownloader(url);
        break;
      case "instagram":
        result = await igDownloader(url);
        break;
      default:
        return res.status(400).json({
          error:
            "Parameter ?type= tidak valid. Gunakan salah satu: ytmp3 | ytmp4 | tiktok | instagram",
        });
    }

    return res.status(200).json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
