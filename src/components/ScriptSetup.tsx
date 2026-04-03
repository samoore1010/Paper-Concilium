import { useState, useCallback } from "react";
import { motion } from "framer-motion";

export interface ScriptConfig {
  mode: "none" | "uploaded" | "generated";
  text: string;
}

interface ScriptSetupProps {
  sessionType: string;
  onContinue: (config: ScriptConfig) => void;
  onBack: () => void;
}

const SUGGESTED_TOPICS: Record<string, string[]> = {
  "business-pitch": [
    "An AI-powered platform that matches freelance workers with short-term housing near their job sites",
    "A subscription service that delivers locally-sourced, chef-prepared meals to office buildings",
    "A fintech app that helps small business owners manage cash flow with predictive analytics",
    "A marketplace connecting retired professionals with startups for part-time advisory roles",
    "A SaaS tool that automates compliance reporting for mid-size financial firms",
    "A wearable device that monitors workplace ergonomics and suggests posture corrections in real-time",
    "A carbon credit trading platform designed specifically for small and medium enterprises",
    "An EdTech platform that uses AI tutors to prepare students for professional certification exams",
  ],
  "mock-trial": [
    "Motion for summary judgment in a defamation case where the plaintiff admitted the statements were true",
    "Opening statement in a breach of contract dispute over a failed software delivery",
    "Closing argument in a wrongful termination case involving alleged whistleblower retaliation",
    "Cross-examination of an expert witness in a medical malpractice case",
    "Motion to suppress evidence obtained through an allegedly unlawful search of digital records",
    "Opening statement in a trade secret misappropriation case between former business partners",
    "Argument for preliminary injunction in a non-compete agreement dispute",
    "Closing argument in a product liability case involving a defective consumer device",
  ],
  "public-speaking": [
    "How remote work is reshaping urban planning and community design",
    "The science of habit formation and how to make lasting behavioral changes",
    "Why emotional intelligence matters more than IQ in modern leadership",
    "The hidden costs of social media on attention span and deep thinking",
    "How space exploration technology is solving problems on Earth",
    "The future of food: lab-grown meat, vertical farms, and feeding 10 billion people",
    "Why failure is the most underrated skill in education",
    "The ethics of AI decision-making in healthcare, criminal justice, and hiring",
  ],
  "sales-demo": [
    "Demonstrating a CRM platform that uses AI to prioritize leads and predict deal outcomes",
    "Pitching a cybersecurity solution to a mid-size company that just experienced a data breach",
    "Walking through a project management tool designed for creative agencies",
    "Presenting an HR analytics platform that predicts employee attrition risk",
    "Demonstrating a cloud migration service to a company running legacy on-premise infrastructure",
    "Pitching an e-commerce personalization engine to a retail brand with declining conversion rates",
    "Presenting a document automation tool to a law firm spending hours on manual contract review",
    "Demonstrating a fleet management platform to a logistics company looking to cut fuel costs",
  ],
};

function getRandomTopic(sessionType: string, exclude?: string): string {
  const topics = SUGGESTED_TOPICS[sessionType] || SUGGESTED_TOPICS["business-pitch"];
  const available = exclude ? topics.filter((t) => t !== exclude) : topics;
  return available[Math.floor(Math.random() * available.length)];
}

function getSessionLabel(sessionType: string): string {
  const labels: Record<string, string> = {
    "business-pitch": "Business Pitch",
    "mock-trial": "Mock Trial",
    "public-speaking": "Public Speaking",
    "sales-demo": "Sales Demo",
  };
  return labels[sessionType] || sessionType.replace(/-/g, " ");
}

export function ScriptSetup({ sessionType, onContinue, onBack }: ScriptSetupProps) {
  const [mode, setMode] = useState<"none" | "upload" | "generate">("none");
  const [uploadedText, setUploadedText] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState("");

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, sessionType, durationMinutes: duration }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedText(data.script);
      } else {
        alert("Failed to generate script. Make sure the LLM backend is configured.");
      }
    } catch {
      alert("Failed to connect to server.");
    }
    setIsGenerating(false);
  };

  const handleSuggestTopic = useCallback(() => {
    const topic = getRandomTopic(sessionType, description);
    setDescription(topic);
  }, [sessionType, description]);

  const handleContinue = () => {
    if (mode === "upload" && uploadedText.trim()) {
      onContinue({ mode: "uploaded", text: uploadedText.trim() });
    } else if (mode === "generate" && generatedText.trim()) {
      onContinue({ mode: "generated", text: generatedText.trim() });
    } else {
      onContinue({ mode: "none", text: "" });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-surface-base text-white flex flex-col">
      <header className="border-b border-white/5 px-4 md:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button onClick={onBack} className="text-white/40 hover:text-white/70 text-sm">← Back</button>
          <h1 className="text-sm md:text-base font-semibold">Script Setup</h1>
          <div />
        </div>
      </header>

      <div className="flex-1 max-w-3xl mx-auto px-4 md:px-6 py-6 w-full">
        <p className="text-xs md:text-sm text-white/50 mb-6">Would you like to use a teleprompter during your session?</p>

        {/* Mode selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <ModeButton
            selected={mode === "none"}
            onClick={() => setMode("none")}
            icon="🎤"
            title="No Script"
            description="Speak freely without a teleprompter"
          />
          <ModeButton
            selected={mode === "upload"}
            onClick={() => setMode("upload")}
            icon="📄"
            title="My Script"
            description="Paste or type your own script"
          />
          <ModeButton
            selected={mode === "generate"}
            onClick={() => setMode("generate")}
            icon="✨"
            title="Generate Script"
            description="AI writes a script from your description"
          />
        </div>

        {/* Upload mode */}
        {mode === "upload" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <textarea
              value={uploadedText}
              onChange={(e) => setUploadedText(e.target.value)}
              placeholder="Paste or type your script here..."
              className="w-full h-48 md:h-64 bg-surface-raised border border-white/5 rounded-xl p-4 text-sm text-white placeholder-white/30 outline-none focus:border-blue-400/50 resize-none"
            />
            <div className="text-[10px] text-white/30 mt-1">{uploadedText.split(/\s+/).filter(Boolean).length} words</div>
          </motion.div>
        )}

        {/* Generate mode */}
        {mode === "generate" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-white/50">Describe your talk</label>
                <button
                  onClick={handleSuggestTopic}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 transition-colors flex items-center gap-1"
                >
                  <span>🎲</span> Suggest a {getSessionLabel(sessionType)} topic
                </button>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`e.g., ${getRandomTopic(sessionType)}`}
                className="w-full h-24 bg-surface-raised border border-white/5 rounded-xl p-3 text-sm text-white placeholder-white/30 outline-none focus:border-purple-400/50 resize-none"
              />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="bg-surface-raised border border-white/5 rounded-lg px-3 py-2 text-sm text-white outline-none"
                >
                  <option value={1}>1 minute</option>
                  <option value={2}>2 minutes</option>
                  <option value={3}>3 minutes</option>
                  <option value={5}>5 minutes</option>
                </select>
              </div>
              <div className="flex-1" />
              <button
                onClick={handleGenerate}
                disabled={!description.trim() || isGenerating}
                className="px-5 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-40 rounded-lg text-sm font-medium"
              >
                {isGenerating ? "Generating..." : "Generate Script"}
              </button>
            </div>

            {generatedText && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <label className="text-xs text-white/50 mb-1 block">Generated Script (you can edit)</label>
                <textarea
                  value={generatedText}
                  onChange={(e) => setGeneratedText(e.target.value)}
                  className="w-full h-48 md:h-64 bg-surface-raised border border-purple-500/30 rounded-xl p-4 text-sm text-white outline-none resize-none"
                />
                <div className="text-[10px] text-white/30 mt-1">{generatedText.split(/\s+/).filter(Boolean).length} words · ~{Math.round(generatedText.split(/\s+/).filter(Boolean).length / 130)} min</div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Continue button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleContinue}
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-xl text-sm font-medium"
          >
            {mode === "none" ? "Start Without Script" : "Start With Teleprompter"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeButton({ selected, onClick, icon, title, description }: {
  selected: boolean; onClick: () => void; icon: string; title: string; description: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-xl border transition-all ${
        selected ? "border-blue-400 bg-blue-500/10" : "border-white/5 bg-surface-raised hover:bg-surface-overlay"
      }`}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-sm font-medium mb-0.5">{title}</div>
      <div className="text-[10px] text-white/40">{description}</div>
    </button>
  );
}
