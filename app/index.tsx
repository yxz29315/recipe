import React, { useState } from "react";
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const API_URL = "https://recipe-beta-six.vercel.app/api/llm";

const FormattedAnswer = ({ answer }: { answer: string }) => {
  // Remove all LaTeX/math expressions and commands
  // Remove $...$, \(...\), \[...\], and LaTeX commands like \frac, \boxed, etc.
  function latexToPlainMath(text: string) {
    let out = text;
    // Remove markdown headers (##, ###, etc.)
    out = out.replace(/^#+\s*/gm, '');
    // Replace \frac{a}{b} with a / b
    out = out.replace(/\\frac{([^}]*)}{([^}]*)}/g, '$1 / $2');
    // Replace \boxed{a} with a
    out = out.replace(/\\boxed{([^}]*)}/g, '$1');
    // Replace \neq or != with ≠
    out = out.replace(/\\neq|!=/g, '≠');
    // Replace >= and <=
    out = out.replace(/\\geq|>=/g, '≥');
    out = out.replace(/\\leq|<=/g, '≤');
  // Replace superscripts: x^{2} => x² (for 0-9 and common variables)
  out = out.replace(/([a-zA-Z0-9])\s*\^\s*{\s*([0-9a-zA-Z+-]+)\s*}/g, (m, base, sup) => base + toSuperscript(sup));
  // Replace x^2 (no braces) => x²
  out = out.replace(/([a-zA-Z0-9])\s*\^\s*([0-9a-zA-Z+-])/g, (m, base, sup) => base + toSuperscript(sup));
  // Replace (expr)^2 => (expr)²
  out = out.replace(/(\([^()]+\))\s*\^\s*([0-9a-zA-Z+-])/g, (m, expr, sup) => expr + toSuperscript(sup));
  // Replace numbers like 3 ^ 2 => 3²
  out = out.replace(/(\d+)\s*\^\s*([0-9a-zA-Z+-])/g, (m, num, sup) => num + toSuperscript(sup));
    // Replace subscripts: x_{2} => x₂
    out = out.replace(/([a-zA-Z0-9])_{([0-9a-zA-Z+-]+)}/g, (m, base, sub) => base + toSubscript(sub));
    // Remove $...$, \(...\), \[...\] but keep content
    out = out.replace(/\$([^$]+)\$/g, '$1');
    out = out.replace(/\\\((.*?)\\\)/g, '$1');
    out = out.replace(/\\\[(.*?)\\\]/gs, '$1');
    // Remove remaining LaTeX commands (\text, etc.)
    out = out.replace(/\\[a-zA-Z]+\s?/g, '');
    // Remove curly braces
    out = out.replace(/[{}]/g, '');
    // Remove multiple spaces
    out = out.replace(/  +/g, ' ');
    // Fix common math spacing
    out = out.replace(/\s*([=≠≥≤+\-*/^])\s*/g, ' $1 ');
    // Remove spaces before punctuation
    out = out.replace(/\s+([.,;:!?)])/g, '$1');
    // Remove spaces after opening parens
    out = out.replace(/([(])\s+/g, '$1');
    // Remove spaces before closing parens
    out = out.replace(/\s+([)])/g, '$1');
    return out.trim();
  }

  // Helper for superscript (supports 0-9, +, -, a-z, A-Z)
  function toSuperscript(str: string) {
    const map: { [key: string]: string } = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
      '+': '⁺', '-': '⁻', 'n': 'ⁿ', 'i': 'ⁱ', 'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'j': 'ʲ', 'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ', 'A': 'ᴬ', 'B': 'ᴮ', 'D': 'ᴰ', 'E': 'ᴱ', 'G': 'ᴳ', 'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ', 'K': 'ᴷ', 'L': 'ᴸ', 'M': 'ᴹ', 'N': 'ᴺ', 'O': 'ᴼ', 'P': 'ᴾ', 'R': 'ᴿ', 'T': 'ᵀ', 'U': 'ᵁ', 'V': 'ⱽ', 'W': 'ᵂ'
    };
    return str.split('').map(c => map[c] || c).join('');
  }
  // Helper for subscript (supports 0-9, +, -, a-z, A-Z)
  function toSubscript(str: string) {
    const map: { [key: string]: string } = {
      '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
      '+': '₊', '-': '₋', 'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ', 'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ'
    };
    return str.split('').map(c => map[c] || c).join('');
  }

  const finalAnswerMatch = answer.match(/The final answer is: (.*)/s);
  let finalAnswer = finalAnswerMatch
    ? latexToPlainMath(finalAnswerMatch[1])
    : null;

  const stepsPart = finalAnswerMatch
    ? answer.substring(0, finalAnswerMatch.index)
    : answer;
  const steps = stepsPart.split(/(Step \d+:)/).filter((p) => p.trim());

  return (
    <View>
      {steps.map((step, index) => {
        if (step.startsWith("Step")) {
          return (
            <Text key={index} style={styles.stepHeader}>
              {step}
            </Text>
          );
        }
        const lines = step.trim().split("\n");
        return lines.map((line, lineIndex) => (
          <Text key={`${index}-${lineIndex}`} style={styles.stepContent}>
            {latexToPlainMath(line)}
          </Text>
        ));
      })}
      {finalAnswer && (
        <View style={styles.finalAnswerContainer}>
          <Text style={styles.finalAnswerText}>The final answer is:</Text>
          <View style={styles.boxedAnswer}>
            <Text style={styles.boxedAnswerText}>{finalAnswer}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default function Index() {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setAnswer("");
    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setAnswer(data.text);
    } catch (e: any) {
      setError(e.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ask the model</Text>
      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Type your question…"
        multiline
        style={styles.input}
      />
      <Button title="Send" onPress={ask} />
      {loading && <ActivityIndicator />}
      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {!!answer && (
        <View style={styles.answerContainer}>
          <Text style={styles.answerTitle}>Answer</Text>
          <FormattedAnswer answer={answer} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    minHeight: 80,
  },
  errorText: {
    color: "red",
  },
  answerContainer: {
    marginTop: 12,
  },
  answerTitle: {
    fontWeight: "600",
    fontSize: 16,
    marginBottom: 8,
  },
  stepHeader: {
    fontWeight: "bold",
    marginTop: 8,
    fontSize: 16,
    marginBottom: 4,
  },
  stepContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  finalAnswerContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  finalAnswerText: {
    fontWeight: "bold",
    fontSize: 16,
  },
  boxedAnswer: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 8,
    backgroundColor: "#f0f8ff",
  },
  boxedAnswerText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#007AFF",
  },
  mathExpression: {
    fontStyle: "italic",
    fontFamily: "monospace",
    backgroundColor: "#eee",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
});