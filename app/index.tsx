// Index.tsx
import { MathJax, MathJaxContext } from "better-react-mathjax";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Button,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MathJaxSVG from "react-native-mathjax-svg";

const API_URL = "https://recipe-beta-six.vercel.app/api/llm";

/** ---------- Web/native math renderer ---------- */
const RNMath = ({
  latex,
  display = false,
}: {
  latex: string;
  display?: boolean;
}) =>
  Platform.OS === "web" ? (
    <MathJaxContext>
      <MathJax dynamic>{display ? `\\[${latex}\\]` : `\\(${latex}\\)`}</MathJax>
    </MathJaxContext>
  ) : (
    <MathJaxSVG fontSize={display ? 18 : 14} color="black" fontCache>
      {display ? `$$${latex}$$` : `$${latex}$`}
    </MathJaxSVG>
  );

/** ---------- Helpers to split text vs math ---------- */
type Chunk =
  | { type: "text"; value: string }
  | { type: "math"; value: string; display: boolean };

// Matches: \[...\] | $$...$$ | \(...\) | $...$ | \begin{aligned}...\end{aligned} | \boxed{...}
const MATH_REGEX =
  /(\\\[([\s\S]*?)\\\])|(\$\$([\s\S]*?)\$\$)|(\\\(([\s\S]*?)\\\))|(\$([^$]*?)\$)|(\\begin\{aligned\}[\s\S]*?\\end\{aligned\})|(\\boxed\{[\s\S]*?\})/g;

function splitAnswer(input: string): Chunk[] {
  const out: Chunk[] = [];
  let last = 0;

  input.replace(
    MATH_REGEX,
    (
      match: string,
      _g1: string,
      brack: string,
      _g3: string,
      dbl: string,
      _g5: string,
      paren: string,
      _g7: string,
      inline: string,
      aligned: string,
      boxed: string,
      offset: number
    ) => {
      const i = offset;
      if (i > last) out.push({ type: "text", value: input.slice(last, i) });

      if (dbl != null) out.push({ type: "math", value: dbl, display: true });
      else if (brack != null) out.push({ type: "math", value: brack, display: true });
      else if (paren != null) out.push({ type: "math", value: paren, display: false });
      else if (inline != null) out.push({ type: "math", value: inline, display: false });
      else if (aligned != null) out.push({ type: "math", value: aligned, display: true });
      else if (boxed != null) out.push({ type: "math", value: boxed, display: false });

      last = i + match.length;
      return match;
    }
  );

  if (last < input.length) out.push({ type: "text", value: input.slice(last) });
  return out;
}

/** ---------- FormattedAnswer component (compact spacing) ---------- */
const FormattedAnswer = ({ answer }: { answer: string }) => {
  const chunks = splitAnswer(answer);

  const renderTextBlock = (text: string, keyBase: string) => {
    // Normalize line endings and collapse repeated blanks
    const lines = text.replace(/\r/g, "").split("\n");
    const els: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();

      // Skip empty or lone hyphen lines (these often come from bullet formatting)
      if (!line || line === "-") continue;

      if (line.startsWith("## ")) {
        els.push(
          <Text key={`${keyBase}-h2-${i}`} style={styles.h2}>
            {line.substring(3)}
          </Text>
        );
        continue;
      }
      if (line.startsWith("### ")) {
        els.push(
          <Text key={`${keyBase}-h3-${i}`} style={styles.h3}>
            {line.substring(4)}
          </Text>
        );
        continue;
      }
      if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
        els.push(
          <Text key={`${keyBase}-b-${i}`} style={styles.bold}>
            {line.slice(2, -2)}
          </Text>
        );
        continue;
      }

      // Bullets: "- " or "•"
      if (line.startsWith("- ")) {
        els.push(
          <Text key={`${keyBase}-li-${i}`} style={styles.li}>
            {"\u2022 "} {line.slice(2)}
          </Text>
        );
        continue;
      }
      if (line.startsWith("•")) {
        els.push(
          <Text key={`${keyBase}-li2-${i}`} style={styles.li}>
            {"\u2022 "} {line.slice(1).trimStart()}
          </Text>
        );
        continue;
      }

      // Default paragraph line
      els.push(
        <Text key={`${keyBase}-p-${i}`} style={styles.p}>
          {raw.trimEnd()}
        </Text>
      );
    }

    return els;
  };

  return (
    <View>
      {chunks.map((c, idx) =>
        c.type === "text" ? (
          <View key={`t-${idx}`}>{renderTextBlock(c.value, `t-${idx}`)}</View>
        ) : (
          <View key={`m-${idx}`} style={c.display ? styles.mathBlock : styles.mathInline}>
            <RNMath latex={c.value} display={c.display} />
          </View>
        )
      )}
    </View>
  );
};

/** ---------- Screen ---------- */
export default function Index() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async (useCamera: boolean) => {
    let result: any;
    if (useCamera) {
      await ImagePicker.requestCameraPermissionsAsync();
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });
    } else {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });
    }

    if (!result.canceled) {
      setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const ask = async () => {
    if (!prompt.trim() && !image) return;
    setLoading(true);
    setError(null);
    setAnswer("");
    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, image }),
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
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Ask the model</Text>

        <View style={styles.topButtonContainer}>
          <TouchableOpacity style={styles.topButton} onPress={() => pickImage(true)}>
            <Text style={styles.topButtonText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.topButton} onPress={() => pickImage(false)}>
            <Text style={styles.topButtonText}>Choose from Library</Text>
          </TouchableOpacity>
        </View>

        {image && (
          <View>
            <Image source={{ uri: image }} style={styles.imagePreview} />
            <Button title="Remove Image" onPress={() => setImage(null)} />
          </View>
        )}

        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder="(Optional) add ingredients not in image…"
          placeholderTextColor="#888" // Added
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
      </ScrollView>
    </View>
  );
}

/** ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { padding: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 20 },

  // Text styles with compact spacing
  p: { marginBottom: 4, lineHeight: 20, fontSize: 16 },
  li: { marginBottom: 4, lineHeight: 20, fontSize: 16 },
  bold: { fontWeight: "bold", marginBottom: 6, fontSize: 16 },
  h2: { fontSize: 20, fontWeight: "bold", marginTop: 10, marginBottom: 6 },
  h3: { fontSize: 18, fontWeight: "bold", marginTop: 8, marginBottom: 4 },

  // Math spacing (tighter)
  mathBlock: { marginVertical: 6 },
  mathInline: { marginVertical: 0 },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    minHeight: 80,
  },
  errorText: { color: "red" },
  answerContainer: { marginTop: 12 },
  answerTitle: { fontWeight: "600", fontSize: 16, marginBottom: 8 },

  stepHeader: { fontWeight: "bold", marginTop: 8, fontSize: 16, marginBottom: 4 },
  stepContent: { fontSize: 14, lineHeight: 20 },
  finalAnswerContainer: { marginTop: 16, alignItems: "center" },
  finalAnswerText: { fontWeight: "bold", fontSize: 16 },
  boxedAnswer: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 8,
    backgroundColor: "#f0f8ff",
  },
  boxedAnswerText: { fontSize: 28, fontWeight: "bold", color: "#007AFF" },
  mathExpression: {
    fontStyle: "italic",
    fontFamily: "monospace",
    backgroundColor: "#eee",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  mathView: { width: "100%" },
  imagePreview: { width: "100%", height: 200, borderRadius: 8, marginBottom: 12 },

  topButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  topButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 5,
  },
  topButtonText: { color: "white", fontSize: 16, fontWeight: "bold" },
});
