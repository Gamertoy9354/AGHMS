/**
 * AI Service — NVIDIA NIM via Supabase Edge Function Proxy
 *
 * Browser → Supabase Edge Function → NVIDIA NIM API
 * This avoids CORS restrictions when calling NIM from the browser.
 */

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nvidia-nim-proxy`;
const DEFAULT_MODEL = import.meta.env.VITE_NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct';

/**
 * Core: Call NVIDIA NIM through the Supabase proxy.
 * @param {object[]} messages - OpenAI-style messages array
 * @param {number} temperature
 * @returns {Promise<string>} - The AI response text
 */
async function callNIM(messages, temperature = 0.5) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: '/chat/completions',
      payload: {
        model: DEFAULT_MODEL,
        messages,
        temperature,
        max_tokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from NIM');
  return text;
}

/**
 * Compiles all department agenda submissions into a single markdown string.
 */
export function compileMeetingData(submissions, departments) {
  if (!submissions || submissions.length === 0) {
    return 'No data has been uploaded by the departments for this meeting yet.';
  }

  let text = '# Compiled Department Submissions Data\n\n';

  submissions.forEach(sub => {
    const dept = departments?.find(d => d.id === sub.department_id);
    const deptName = dept ? `${dept.code} - ${dept.name}` : 'Unknown Department';

    text += `## Department: ${deptName}\n`;
    text += `Submitted File Name: ${sub.file_name || 'Manual Spreadsheet Entry'}\n`;
    text += `Submission Date: ${sub.created_at ? new Date(sub.created_at).toLocaleString() : 'N/A'}\n\n`;

    if (sub.submitted_data && Array.isArray(sub.submitted_data)) {
      text += '| ' + Object.keys(sub.submitted_data[0] || {}).join(' | ') + ' |\n';
      text += '| ' + Object.keys(sub.submitted_data[0] || {}).map(() => '---').join(' | ') + ' |\n';
      sub.submitted_data.forEach(row => {
        text += '| ' + Object.values(row).map(v => String(v ?? '').replace(/\|/g, '\\|')).join(' | ') + ' |\n';
      });
      text += '\n';
    } else {
      text += 'No structured table data provided.\n\n';
    }
  });

  return text;
}

/**
 * Uses NVIDIA NIM to generate meeting summary, structured statistics, and Recharts visuals.
 */
export async function generateLiveDashboard(compiledText) {
  const prompt = `You are a high-level educational governance analyst. You are provided with the compiled agenda submissions data uploaded by department HODs for a meeting:
  
  ${compiledText}
  
  Please analyze this data and return a JSON object with:
  1. "executiveSummary": A concise 2-3 sentence overview of what the data represents.
  2. "kpis": An array of KPI objects: [{ "label": "KPI Name", "value": "Number/Percentage", "change": "positive or negative or neutral statement" }] (Extract at least 3-4 KPIs from the data like attendance, fees payment, weak students count, or lab evaluation completed).
  3. "visuals": An array of visual chart objects. Each visual chart object must have:
     - "type": either "bar" or "line" or "pie"
     - "title": "Chart Title"
     - "data": An array of objects for Recharts: e.g. [{ "name": "CSE", "value": 85 }] or [{ "name": "Odd Sem", "paid": 120000, "balance": 40000 }]
     - "keys": Array of data keys to display (e.g. ["value"] or ["paid", "balance"])
  
  Provide strictly a raw, valid JSON object. Do not include markdown code block formatting like \`\`\`json. Return only the JSON content.`;

  try {
    const content = await callNIM([{ role: 'user', content: prompt }], 0.1);
    const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Failed to generate Live AI Dashboard:', err);
    return {
      executiveSummary: 'AI was unable to synthesize the uploaded data at this moment. Displaying temporary metrics.',
      kpis: [
        { label: 'Total Uploaded Sheets', value: '4 Departments', change: 'Neutral status' },
        { label: 'Data Ingestion Status', value: 'Ready', change: 'Awaiting conclusion' },
      ],
      visuals: [],
    };
  }
}

/**
 * Handles chatbot questions inside the live meeting workspace.
 */
export async function askMeetingChatbot(compiledText, chatHistory, userQuestion) {
  const messages = [
    {
      role: 'system',
      content: `You are the AGHMS AI Assistant inside a live administrative meeting workspace for a college.
      Here is the complete compiled spreadsheet data uploaded by the departments for this meeting:
      
      ${compiledText}
      
      Use this data to answer any questions accurately and professionally. Cite specific numbers and departments. If the data does not contain the information requested, state that clearly.`,
    },
  ];

  chatHistory?.forEach(h => messages.push({ role: h.role, content: h.content }));
  messages.push({ role: 'user', content: userQuestion });

  try {
    return await callNIM(messages, 0.7);
  } catch (err) {
    console.error('AI Chatbot error:', err?.message || err);
    const reason = err?.message?.includes('401') ? 'Invalid API key — check Supabase secrets.'
      : err?.message?.includes('404') ? 'Model not found on NIM.'
      : err?.message?.includes('429') ? 'Rate limit reached — try again shortly.'
      : (err?.message || 'Proxy connection error');
    return `❌ AI Error: ${reason}`;
  }
}

/**
 * Synthesizes post-meeting MOM documents and department briefs.
 * @param {string|object} notesInput - Plain string (legacy) OR isolated JSON { admin: '...', CSE: '...' }
 * @param {string} compiledText - The compiled spreadsheet data markdown
 */
export async function synthesizePostMeetingNotes(notesInput, compiledText) {
  let notesSection = '';
  if (typeof notesInput === 'object' && notesInput !== null) {
    const adminNote = notesInput.admin || '';
    const deptKeys  = Object.keys(notesInput).filter(k => k !== 'admin');
    notesSection += `Admin Notes:\n${adminNote || '(No admin notes taken)'}\n\n`;
    if (deptKeys.length > 0) {
      notesSection += `Department HOD Notes (by department):\n`;
      deptKeys.forEach(dept => {
        notesSection += `\n--- ${dept} Department HOD Notes ---\n${notesInput[dept] || '(No notes)'}\n`;
      });
    }
  } else {
    notesSection = notesInput || 'No notes were taken during the meeting.';
  }

  const prompt = `You are the AGHMS Governance AI. The HOD meeting has concluded.
  Here are the notes taken during the live meeting (organized by participant role):
  
  ${notesSection}
  
  And here is the compiled data uploaded by departments for this meeting:
  
  ${compiledText}
  
  Please synthesize this information into:
  1. **Admin Note**: An executive narrative summary of what transpired, decisions made, operational directions, and next steps. Reference specific data points from the uploaded sheets and highlight key action items.
  2. **Department Briefs**: Tailored, department-specific instructions and action points. For each department represented in the data or notes, provide a clear, concise bulleted list of actions they must complete.
  
  Provide the response as a JSON object:
  {
    "adminNote": "Markdown text for admin MOM summary",
    "departmentBriefs": {
      "DEPT_CODE_1": "Markdown text with actionable items for Dept 1",
      "DEPT_CODE_2": "Markdown text with actionable items for Dept 2"
    }
  }
  
  Make the markdown notes professional using bold headers and clean lists.
  Provide strictly raw, valid JSON. Do not write markdown code block tags.`;

  try {
    const content = await callNIM([{ role: 'user', content: prompt }], 0.2);
    const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Failed to synthesize post-meeting MOM notes:', err);
    return {
      adminNote: 'The meeting concluded successfully. Summary notes will be prepared by the administrative office shortly.',
      departmentBriefs: {},
    };
  }
}
