import { GenerateContentConfig, HarmCategory, HarmBlockThreshold } from "@google/genai";
import Thumbnail from "../models/Thumbnail.js";
import { Request, Response } from "express";
import ai from "../configs/ai.js";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

// ---------------- STYLE MAPS ----------------

const stylePrompts = {
  "Bold & Graphic":
    "eye-catching thumbnail, bold typography, vibrant colors, expressive facial reaction, dramatic lighting, high contrast, click-worthy composition, professional style",

  "Tech/Futuristic":
    "futuristic thumbnail, sleek modern design, digital UI elements, glowing accents, holographic effects, cyber-tech aesthetic, sharp lighting, high-tech atmosphere",

  "Minimalist":
    "minimalist thumbnail, clean layout, simple shapes, limited color palette, plenty of negative space, modern flat design, clear focal point",

  "Photorealistic":
    "photorealistic thumbnail, ultra-realistic lighting, natural skin tones, candid moment, DSLR-style photography, lifestyle realism, shallow depth of field",

  "Illustrated":
    "illustrated thumbnail, custom digital illustration, stylized characters, bold outlines, vibrant colors, creative cartoon or vector art style",
};

const colorSchemeDescriptions = {
  vibrant: "vibrant and energetic colors, high saturation, bold contrasts",
  sunset: "warm sunset tones, orange pink purple cinematic glow",
  forest: "natural green earthy calm palette",
  neon: "neon cyberpunk glowing high contrast colors",
  purple: "purple magenta violet modern aesthetic",
  monochrome: "black and white dramatic high contrast",
  ocean: "cool blue teal fresh aquatic tones",
  pastel: "soft pastel low saturation gentle tones",
};

// ---------------- MAIN CONTROLLER ----------------

export const generateThumbnail = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;

    const {
      title,
      prompt: user_prompt,
      style,
      aspect_ratio,
      color_scheme,
      text_overlay,
    } = req.body;

    // 1. Create DB entry
    const thumbnail = await Thumbnail.create({
      userId,
      title,
      prompt_used: user_prompt,
      user_prompt,
      style,
      aspect_ratio,
      color_scheme,
      text_overlay,
      isGenerating: true,
    });

    // 2. Model config
const model = 'gemini-3-pro-image-preview';

    const generationConfig: GenerateContentConfig = {
      maxOutputTokens: 32768,
      temperature: 1,
      topP: 0.95,
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: aspect_ratio || "16:9",
        imageSize: "1k",
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.OFF },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.OFF },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.OFF },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.OFF },
      ],
    };

    // 3. Build prompt
    let prompt = `create a ${
      stylePrompts[style as keyof typeof stylePrompts]
    } for "${title}"`;

    if (color_scheme) {
      prompt += ` use ${colorSchemeDescriptions[color_scheme as keyof typeof colorSchemeDescriptions]} color scheme.`;
    }

    if (user_prompt) {
      prompt += ` Additional details: ${user_prompt}.`;
    }

    prompt += ` Make it ${aspect_ratio}, highly clickable, professional, and visually stunning.`;

    // 4. AI call
    const response: any = await ai.models.generateContent({
      model,
      contents: [prompt],
      config: generationConfig,
    });

    console.log("AI RESPONSE RECEIVED");

    const parts = response?.candidates?.[0]?.content?.parts;

    if (!parts) {
      throw new Error("No response from AI");
    }

    // 5. Extract image buffer
    let finalBuffer: Buffer | null = null;

    for (const part of parts) {
      if (part.inlineData) {
        finalBuffer = Buffer.from(part.inlineData.data, "base64");
      }
    }

    if (!finalBuffer) {
      throw new Error("AI did not generate image");
    }

    // 6. Save locally
    const filename = `thumb-${Date.now()}.png`;
    const filePath = path.join("images", filename);

    fs.mkdirSync("images", { recursive: true });
    fs.writeFileSync(filePath, finalBuffer);

    // 7. Upload to cloudinary
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      resource_type: "image",
    });

    // 8. Update DB
    thumbnail.image_url = uploadResult.url;
    thumbnail.isGenerating = false;

    await thumbnail.save();

    // 9. Cleanup local file
    fs.unlinkSync(filePath);

    // 10. Response
    return res.json({
      message: "Thumbnail Generated Successfully",
      thumbnail,
    });
  } catch (error: any) {
    console.log("THUMBNAIL ERROR:", error);

    return res.status(500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

// ---------------- DELETE ----------------

export const deleteThumbnail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.session;

    await Thumbnail.findOneAndDelete({ _id: id, userId });

    return res.json({
      message: "Thumbnail deleted successfully",
    });
  } catch (error: any) {
    console.log(error);

    return res.status(500).json({
      message: error.message,
    });
  }
};