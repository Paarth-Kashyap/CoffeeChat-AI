
export interface Contact {
  email: string;
  name?: string;
}

export interface OutreachResult {
  email: string;
  companyName: string;
  research: string;
  draftedEmail: string;
  sources: { title: string; uri: string }[];
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

export interface UserProfile {
  // Identity
  userName: string;
  education: string;         
  // Professional Context
  currentRole: string;     
  targetRole: string;      
  targetTerm?: string;     
  // Experience & Assets
  resumeText: string;      
  philosophy: string;     
  experienceContext: string; 
  interests: string;
  keyAchievements: string;
  // Customization
  customTailoringInstructions: string; 
  customRules?: string;
}
