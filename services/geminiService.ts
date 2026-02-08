
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { UserProfile, OutreachResult } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY});
  }

  async processOutreach(
    contactEmail: string,
    profile: UserProfile
  ): Promise<OutreachResult> {
    const [localPart, domain] = contactEmail.split('@');
    
    // Attempt basic name extraction from email (e.g., paarth.kashyap -> Paarth)
    const nameCandidate = localPart.split(/[._-]/)[0];
    const capitalizedName = nameCandidate.charAt(0).toUpperCase() + nameCandidate.slice(1);

    const prompt = `
      Research the company associated with the domain "${domain}". 
      
      1. Identify the company name.
      2. Find their core products or recent updates relevant to the user's field.
      3. User Context (The Sender):
        - Name: ${profile.userName}
        - Education/Background: ${profile.education}
        - Current Status: ${profile.currentRole}
        - Career Goal: ${profile.targetRole}
        - Core Philosophy: ${profile.philosophy}
        - Interests & Key Achievements: ${profile.interests}, ${profile.keyAchievements}
        - Specific Experience Context: ${profile.experienceContext}
        - Resume/Background: ${profile.resumeText.substring(0, 3500)}

      4. Draft a hyper-personalized, ultra-concise email (Hi [Name]) asking for a 15-min coffee chat.

      STRICT DRAFTING CONSTRAINTS:
      - BREVITY: The entire email must be 3 sentences maximum. 
      - STRUCTURE: 
          Sentence 1: An attention catcher about a specific thing they are building or a recent fintech/quant update.
          Sentence 2: A brief tie-in to the user's specific background (e.g., UofT Engineering) or building mindset.
          Sentence 3: A low-pressure ask for a 15-min coffee chat regarding a ${profile.targetTerm || "Summer 2026 software internship"} and how the user can add value.
      - TONE: Keep it humble and builder-focused.
      - ACCURACY: Be strictly truthful to the provided background; do not hallucinate achievements. 
      - CUSTOM RULES: ${profile.customRules || "No special rules."}
      - FORMATTING: No em-dashes (—). Use commas or periods. No percentages or data points.

      USER CUSTOM INSTRUCTIONS:
      ${profile.customTailoringInstructions}

      Please provide the response in this structure:
      Company Name: [Name]
      Research Summary: [Details about values/products]
      Alignment Explanation: [Why this student is a fit]
      Drafted Email: [The full email draft including subject line]
    `;

    try {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || "Failed to generate content.";
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          title: chunk.web.title,
          uri: chunk.web.uri,
        }));

      const companyMatch = text.match(/Company Name:?\s*(.*)/i);
      const companyName = companyMatch ? companyMatch[1].split('\n')[0].trim() : domain;

      return {
        email: contactEmail,
        companyName,
        research: text,
        draftedEmail: this.extractDraftedEmail(text),
        sources,
        status: 'completed',
      };
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      let errorMessage = error.message || "An unexpected error occurred";
      
      // Check for quota or 429 errors
      if (errorMessage.toLowerCase().includes("quota") || errorMessage.includes("429")) {
        errorMessage = "QUOTA_EXCEEDED: The API quota has been reached. Stopping script.";
      }

      return {
        email: contactEmail,
        companyName: domain,
        research: "",
        draftedEmail: "",
        sources: [],
        status: 'error',
        error: errorMessage,
      };
    }
  }

  private extractDraftedEmail(text: string): string {
    const draftMarkers = ["Drafted Email:", "Email Draft:", "Subject:"];
    for (const marker of draftMarkers) {
      const index = text.indexOf(marker);
      if (index !== -1) {
        return text.substring(index + marker.length).trim();
      }
    }
    return "Could not extract specific draft. Please review the research below.";
  }
}
