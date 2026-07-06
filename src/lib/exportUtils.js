import { jsPDF } from 'jspdf';

// ─── CSV Export Utility ───────────────────────────────────────────────────────
export function exportToCSV(data, filename = 'export.csv') {
  if (!data || !data.length) {
    console.warn('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  const csvRows = [];
  // Add headers
  csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));

  // Add rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      const str = val === null || val === undefined ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }

  // Create Blob and trigger download
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) { // feature detection
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// ─── PDF Export Utility Helpers ───────────────────────────────────────────────
function getWeekendHoliday(year, month, day) {
  const date = new Date(year, month, day);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  
  if (dayOfWeek === 0) {
    return {
      id: `sunday-${year}-${month}-${day}`,
      title: 'Sunday (Weekly Off)',
      type: 'holiday',
      start_date: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
      end_date: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
      week: 0,
      semester_type: 'both'
    };
  }
  
  if (dayOfWeek === 6) {
    const occurrence = Math.ceil(day / 7);
    if (occurrence === 2) {
      return {
        id: `2sat-${year}-${month}-${day}`,
        title: '2nd Saturday (Holiday)',
        type: 'holiday',
        start_date: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
        end_date: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
        week: 0,
        semester_type: 'both'
      };
    }
    if (occurrence === 4) {
      return {
        id: `4sat-${year}-${month}-${day}`,
        title: '4th Saturday (Holiday)',
        type: 'holiday',
        start_date: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
        end_date: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
        week: 0,
        semester_type: 'both'
      };
    }
  }
  
  return null;
}

function getAcademicWeekForDate(dateStr, semesters, tab) {
  const semester = semesters?.find(s => s.semester_type === tab);
  if (!semester || !semester.start_date || !semester.end_date) return null;
  
  const date = new Date(dateStr);
  const start = new Date(semester.start_date);
  const end = new Date(semester.end_date);
  
  date.setHours(0,0,0,0);
  start.setHours(0,0,0,0);
  end.setHours(0,0,0,0);
  
  if (date < start || date > end) return null;
  
  const diffTime = date - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  return week <= 26 ? week : null;
}

function getWeekendHolidaysInRange(startDateStr, endDateStr, semesters, semesterType) {
  if (!startDateStr || !endDateStr) return [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  start.setHours(0,0,0,0);
  end.setHours(0,0,0,0);
  
  const holidays = [];
  let curr = new Date(start);
  
  while (curr <= end) {
    const y = curr.getFullYear();
    const m = curr.getMonth();
    const d = curr.getDate();
    
    const holiday = getWeekendHoliday(y, m, d);
    if (holiday) {
      const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const week = getAcademicWeekForDate(dateStr, semesters, semesterType);
      if (week !== null) {
        holidays.push({
          ...holiday,
          week: week,
          semester_type: semesterType
        });
      }
    }
    
    curr.setDate(curr.getDate() + 1);
  }
  
  return holidays;
}

function formatPdfDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const options = { day: '2-digit', month: 'short', year: 'numeric' };
  return d.toLocaleDateString('en-US', options);
}

function getWeekDateRangeStr(semesterStart, weekNum) {
  if (!semesterStart) return 'Date N/A';
  const start = new Date(semesterStart);
  start.setDate(start.getDate() + (weekNum - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  
  const options = { day: '2-digit', month: 'short' };
  const startStr = start.toLocaleDateString('en-US', options);
  const endStr = end.toLocaleDateString('en-US', options);
  const yearStr = start.getFullYear();
  return `${startStr} - ${endStr} ${yearStr}`;
}

// Color palettes matching original application UI
const PDF_THEMES = {
  academic:   { fill: [239, 246, 255], text: [29, 78, 216], badge: [59, 130, 246], label: 'Academic' },
  exam:       { fill: [254, 242, 242], text: [185, 28, 28], badge: [239, 68, 68], label: 'Exam' },
  submission: { fill: [255, 251, 235], text: [180, 83, 9], badge: [245, 158, 11], label: 'Submission' },
  holiday:    { fill: [240, 253, 244], text: [21, 128, 61], badge: [34, 197, 94], label: 'Holiday' },
  weekend:    { fill: [243, 244, 246], text: [75, 85, 99], badge: [156, 163, 175], label: 'Weekend Off' },
  vacation:   { fill: [250, 245, 255], text: [107, 33, 168], badge: [168, 85, 247], label: 'Vacation' },
  other:      { fill: [249, 250, 251], text: [55, 65, 81], badge: [107, 114, 128], label: 'Other' },
};

// ─── PDF Export Main Function ────────────────────────────────────────────────
export function exportCalendarToPDF(rawEvents, semesters, currentYear) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const yearName = currentYear?.year_name || 'Academic Year';
  const semestersData = semesters || [];
  
  const oddSem = semestersData.find(s => s.semester_type === 'odd');
  const evenSem = semestersData.find(s => s.semester_type === 'even');

  // 1. Gather all events including dynamic weekends
  const oddWeekendHolidays = oddSem?.start_date && oddSem?.end_date 
    ? getWeekendHolidaysInRange(oddSem.start_date, oddSem.end_date, semestersData, 'odd') 
    : [];
  const evenWeekendHolidays = evenSem?.start_date && evenSem?.end_date 
    ? getWeekendHolidaysInRange(evenSem.start_date, evenSem.end_date, semestersData, 'even') 
    : [];

  const oddEventsMerged = [
    ...(rawEvents || []).filter(e => e.semester_type === 'odd'),
    ...oddWeekendHolidays
  ];
  const evenEventsMerged = [
    ...(rawEvents || []).filter(e => e.semester_type === 'even'),
    ...evenWeekendHolidays
  ];

  let y = 15;

  const drawPageFooter = (docPage, pageNum, totalPages) => {
    docPage.setDrawColor(229, 231, 235);
    docPage.line(15, 280, 195, 280);
    docPage.setTextColor(156, 163, 175);
    docPage.setFont('Helvetica', 'normal');
    docPage.setFontSize(8);
    docPage.text("Generated by AGHMS Academic Calendar Planner", 15, 287);
    
    const pageStr = totalPages ? `Page ${pageNum} of ${totalPages}` : `Page ${pageNum}`;
    const textWidth = docPage.getTextWidth(pageStr);
    docPage.text(pageStr, 195 - textWidth, 287);
  };

  const drawRunningHeader = (docPage, titleText) => {
    docPage.setFillColor(79, 70, 229); // Indigo banner background
    docPage.rect(15, 15, 180, 12, 'F');
    docPage.setTextColor(255, 255, 255);
    docPage.setFont('Helvetica', 'bold');
    docPage.setFontSize(10);
    docPage.text(titleText, 20, 23);
    
    docPage.setFont('Helvetica', 'normal');
    docPage.setFontSize(8);
    const yrStr = `Year: ${yearName}`;
    const textWidth = docPage.getTextWidth(yrStr);
    docPage.text(yrStr, 195 - textWidth, 23);
  };

  const checkSpace = (neededHeight, semTitle) => {
    if (y + neededHeight > 268) {
      doc.addPage();
      y = 15;
      drawRunningHeader(doc, semTitle);
      y = 35; // margin under header
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // PAGE 1: ODD SEMESTER
  // ───────────────────────────────────────────────────────────────────────────

  // Top Hero Banner
  doc.setFillColor(79, 70, 229); // Indigo-600
  doc.rect(15, 15, 180, 26, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.text("ACADEMIC CALENDAR REPORT", 22, 25);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Academic Year: ${yearName}  |  Consolidated Semester Milestone Chart`, 22, 34);

  // Summary box
  doc.setFillColor(249, 250, 251); // Gray-50
  doc.setDrawColor(229, 231, 235); // Gray-200
  doc.rect(15, 47, 180, 16, 'FD');
  
  doc.setTextColor(55, 65, 81);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text("Summary Insights:", 20, 53);
  
  doc.setFont('Helvetica', 'normal');
  doc.text(`Odd Semester Events: ${oddEventsMerged.filter(e => !e.id?.toString().startsWith('sunday-') && !e.id?.toString().startsWith('2sat-') && !e.id?.toString().startsWith('4sat-')).length} (plus weekends)`, 20, 58);
  
  const genDate = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const textWidth = doc.getTextWidth(`Exported: ${genDate}`);
  doc.text(`Exported: ${genDate}`, 190 - textWidth, 55);

  // Odd Sem Header Row
  doc.setFillColor(67, 56, 202); // Darker Indigo
  doc.rect(15, 69, 180, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text("ODD SEMESTER CALENDAR", 20, 75);
  
  const oddDateRange = oddSem?.start_date && oddSem?.end_date 
    ? `${formatPdfDate(oddSem.start_date)} to ${formatPdfDate(oddSem.end_date)}`
    : 'Not configured';
  const rangeWidth = doc.getTextWidth(oddDateRange);
  doc.setFont('Helvetica', 'normal');
  doc.text(oddDateRange, 190 - rangeWidth, 75);

  y = 86;

  // Print Odd Weeks (1 to 26)
  for (let w = 1; w <= 26; w++) {
    const weekEvents = oddEventsMerged.filter(evt => {
      if (!evt.week) return false;
      const eventWeeks = evt.week.toString().split(',').map(s => parseInt(s.trim(), 10));
      return eventWeeks.includes(w);
    }).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    const rangeStr = getWeekDateRangeStr(oddSem?.start_date, w);

    if (weekEvents.length === 0) {
      checkSpace(7, "ODD SEMESTER CALENDAR");
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(156, 163, 175); // Light Gray
      doc.text(`Week ${w} (${rangeStr})`, 17, y);
      
      doc.setFont('Helvetica', 'italic');
      doc.text("No events scheduled", 95, y);
      
      doc.setDrawColor(243, 244, 246);
      doc.line(15, y + 2, 195, y + 2);
      y += 7;
    } else {
      const neededHeight = 5 + (weekEvents.length * 6.5) + 3;
      checkSpace(neededHeight, "ODD SEMESTER CALENDAR");

      // Week Title Banner
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(17, 24, 39); // Slate-900
      doc.text(`Week ${w} (${rangeStr})`, 17, y);
      y += 4.5;

      weekEvents.forEach(evt => {
        const isWeekendHoliday = evt.id?.toString().startsWith('sunday-') || 
                                 evt.id?.toString().startsWith('2sat-') || 
                                 evt.id?.toString().startsWith('4sat-');
        const theme = isWeekendHoliday ? PDF_THEMES.weekend : (PDF_THEMES[evt.type] || PDF_THEMES.other);

        // Custom list item indicator (bullet circle)
        doc.setFillColor(theme.badge[0], theme.badge[1], theme.badge[2]);
        doc.rect(20, y - 2.2, 2.2, 2.2, 'F');

        // Event Title
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(55, 65, 81);
        doc.text(evt.title, 25, y);

        // Type Tag/Pill Text
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(theme.text[0], theme.text[1], theme.text[2]);
        doc.text(`[${theme.label}]`, 120, y);

        // Event dates
        const dateRangeStr = formatPdfDate(evt.start_date) + (evt.start_date !== evt.end_date ? ` - ${formatPdfDate(evt.end_date)}` : "");
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text(dateRangeStr, 150, y);

        y += 6.2;
      });

      doc.setDrawColor(229, 231, 235);
      doc.line(15, y - 2, 195, y - 2);
      y += 2.5;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // EVEN SEMESTER (Page Break & Cover Banner)
  // ───────────────────────────────────────────────────────────────────────────

  doc.addPage();
  y = 15;

  // Even Sem Header Banner
  doc.setFillColor(16, 185, 129); // Emerald-500 for Even Sem
  doc.rect(15, y, 180, 16, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.text("EVEN SEMESTER CALENDAR", 22, y + 10);

  const evenDateRange = evenSem?.start_date && evenSem?.end_date 
    ? `${formatPdfDate(evenSem.start_date)} to ${formatPdfDate(evenSem.end_date)}`
    : 'Not configured';
  const rangeWidthEven = doc.getTextWidth(evenDateRange);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(evenDateRange, 190 - rangeWidthEven, y + 10);

  y += 24;

  // Print Even Weeks (1 to 26)
  for (let w = 1; w <= 26; w++) {
    const weekEvents = evenEventsMerged.filter(evt => {
      if (!evt.week) return false;
      const eventWeeks = evt.week.toString().split(',').map(s => parseInt(s.trim(), 10));
      return eventWeeks.includes(w);
    }).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    const rangeStr = getWeekDateRangeStr(evenSem?.start_date, w);

    if (weekEvents.length === 0) {
      checkSpace(7, "EVEN SEMESTER CALENDAR");
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(156, 163, 175);
      doc.text(`Week ${w} (${rangeStr})`, 17, y);
      
      doc.setFont('Helvetica', 'italic');
      doc.text("No events scheduled", 95, y);
      
      doc.setDrawColor(243, 244, 246);
      doc.line(15, y + 2, 195, y + 2);
      y += 7;
    } else {
      const neededHeight = 5 + (weekEvents.length * 6.5) + 3;
      checkSpace(neededHeight, "EVEN SEMESTER CALENDAR");

      // Week Title Banner
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(17, 24, 39);
      doc.text(`Week ${w} (${rangeStr})`, 17, y);
      y += 4.5;

      weekEvents.forEach(evt => {
        const isWeekendHoliday = evt.id?.toString().startsWith('sunday-') || 
                                 evt.id?.toString().startsWith('2sat-') || 
                                 evt.id?.toString().startsWith('4sat-');
        const theme = isWeekendHoliday ? PDF_THEMES.weekend : (PDF_THEMES[evt.type] || PDF_THEMES.other);

        // Custom list item indicator
        doc.setFillColor(theme.badge[0], theme.badge[1], theme.badge[2]);
        doc.rect(20, y - 2.2, 2.2, 2.2, 'F');

        // Event Title
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(55, 65, 81);
        doc.text(evt.title, 25, y);

        // Type Tag/Pill Text
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(theme.text[0], theme.text[1], theme.text[2]);
        doc.text(`[${theme.label}]`, 120, y);

        // Event dates
        const dateRangeStr = formatPdfDate(evt.start_date) + (evt.start_date !== evt.end_date ? ` - ${formatPdfDate(evt.end_date)}` : "");
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text(dateRangeStr, 150, y);

        y += 6.2;
      });

      doc.setDrawColor(229, 231, 235);
      doc.line(15, y - 2, 195, y - 2);
      y += 2.5;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Post-Process Footers (Page X of Y)
  // ───────────────────────────────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(doc, i, totalPages);
  }

  // Trigger Save File
  const fileSafeYear = yearName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`Academic_Calendar_${fileSafeYear}.pdf`);
}

// ─── Meeting & Agenda Report PDF Export Main Function ───────────────────────────
export function exportMeetingToPDF(meeting, template, submissions, departments = []) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  // Page bounds & state
  let y = 15;
  const margin = 15;
  const pageHeight = 297;
  const pageWidth = 210;
  const innerWidth = pageWidth - 2 * margin; // 180mm

  // Helper to ensure there's enough space on page, else add page
  const checkSpace = (neededHeight) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      drawHeaderAndFooter();
      y = margin + 15; // reset y, leave room for top page header
    }
  };

  const drawHeaderAndFooter = () => {
    // Top border/line
    doc.setDrawColor(30, 58, 138); // Navy
    doc.setLineWidth(1);
    doc.line(margin, margin, pageWidth - margin, margin);
    
    // Header title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text("AGHMS - ACADEMIC GOVERNANCE & HEADS MEETING SYSTEM", margin, margin - 2);
  };

  const drawPageFooter = (pdfDoc, pageNum, totalPages) => {
    pdfDoc.setFont('Helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(156, 163, 175);
    
    // Left side: timestamp
    const dateStr = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    pdfDoc.text(`Generated on: ${dateStr}`, margin, pageHeight - 8);
    
    // Right side: page number
    const pageText = `Page ${pageNum} of ${totalPages}`;
    const pageTextWidth = pdfDoc.getTextWidth(pageText);
    pdfDoc.text(pageText, pageWidth - margin - pageTextWidth, pageHeight - 8);
    
    // Accent line
    pdfDoc.setDrawColor(229, 231, 235);
    pdfDoc.setLineWidth(0.3);
    pdfDoc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  };

  // --- Draw First Page Header ---
  drawHeaderAndFooter();
  y += 5;

  // Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 58, 138); // Primary color (Navy)
  
  // Wrap meeting title if long
  const titleLines = doc.splitTextToSize(meeting.agenda_title || 'Meeting Agenda', innerWidth);
  titleLines.forEach(line => {
    checkSpace(8);
    doc.text(line, margin, y);
    y += 7;
  });
  
  // Status Badge and Reference Number
  y += 2;
  checkSpace(10);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  const circNum = meeting.circular_number ? `#${meeting.circular_number}` : 'No Circular No.';
  doc.text(circNum, margin, y);
  
  const statusStr = (meeting.status || 'Draft').toUpperCase();
  const statusWidth = doc.getTextWidth(statusStr);
  doc.setFillColor(243, 244, 246);
  doc.rect(margin + 50, y - 4, statusWidth + 8, 5.5, 'F');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(statusStr, margin + 54, y);
  
  y += 8;

  // Horizontal separator
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // --- Meeting Metadata Block ---
  checkSpace(30);
  doc.setFillColor(249, 250, 251); // slate-50 background for metadata
  doc.rect(margin, y, innerWidth, 24, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.rect(margin, y, innerWidth, 24, 'S');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(107, 114, 128);
  doc.text("DATE & TIME", margin + 5, y + 6);
  doc.text("VENUE", margin + 65, y + 6);
  doc.text("ORGANIZED BY", margin + 125, y + 6);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  
  const dateFormatted = formatPdfDate(meeting.meeting_date);
  const timeFormatted = meeting.meeting_time || '—';
  doc.text(`${dateFormatted}`, margin + 5, y + 12);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(timeFormatted, margin + 5, y + 17);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(meeting.venue || '—', margin + 65, y + 12);

  doc.text(meeting.created_by_user?.full_name || '—', margin + 125, y + 12);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(meeting.created_by_user?.role ? meeting.created_by_user.role.toUpperCase() : '—', margin + 125, y + 17);

  y += 32;

  // --- Agenda Items Section ---
  checkSpace(15);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 58, 138);
  doc.text(`Agenda Items (${(meeting.agenda_items || []).length})`, margin, y);
  y += 6;

  const agendaItemsList = meeting.agenda_items || [];
  if (agendaItemsList.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("No agenda items listed.", margin, y);
    y += 8;
  } else {
    agendaItemsList.forEach((item, idx) => {
      // Estimate height needed for this agenda item description and title
      const titleLinesWrapped = doc.splitTextToSize(`${idx + 1}. ${item.title}`, innerWidth - 25);
      const descLinesWrapped = item.description ? doc.splitTextToSize(item.description, innerWidth - 25) : [];
      const itemHeight = 6 + (titleLinesWrapped.length * 5) + (descLinesWrapped.length * 4.5) + 6;

      checkSpace(itemHeight);

      // Category Pill Indicator
      doc.setFillColor(239, 246, 255);
      doc.rect(margin, y - 3, 20, 4.5, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(29, 78, 216);
      doc.text(item.category || 'Review', margin + 2, y + 0.2);

      // Agenda Item Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(17, 24, 39);
      
      let titleY = y;
      titleLinesWrapped.forEach(line => {
        doc.text(line, margin + 24, titleY);
        titleY += 5;
      });

      // Description
      let currentY = titleY;
      if (item.description) {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(75, 85, 99);
        descLinesWrapped.forEach(line => {
          doc.text(line, margin + 24, currentY);
          currentY += 4.5;
        });
      }

      // Metadata (Deadline, Required Docs)
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      let metaStr = '';
      if (item.deadline) metaStr += `Deadline: ${formatPdfDate(item.deadline)}`;
      if (item.required_documents?.length > 0) {
        if (metaStr) metaStr += '  |  ';
        metaStr += `Required Docs: ${item.required_documents.join(', ')}`;
      }
      if (metaStr) {
        doc.text(metaStr, margin + 24, currentY + 1);
        currentY += 5;
      }

      // Draw subtle boundary line between agenda items
      doc.setDrawColor(243, 244, 246);
      doc.setLineWidth(0.3);
      doc.line(margin + 24, currentY + 1, pageWidth - margin, currentY + 1);

      y = currentY + 6;
    });
  }

  // --- Predefined Format Section (if present) ---
  if (template?.format_schema) {
    const columns = template.format_schema.columns || [];
    checkSpace(25);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 138);
    doc.text("Predefined Data Collection Template", margin, y);
    y += 6;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    doc.text(`Title: ${template.title || 'Linked Schema'}`, margin, y);
    y += 5;

    // Draw Column Pills
    checkSpace(18);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text("REQUIRED SPREADSHEET COLUMNS:", margin, y);
    y += 4.5;

    let pillX = margin;
    let pillY = y;

    columns.forEach(col => {
      const colLabel = `${col.name} (${col.type})`;
      const labelWidth = doc.getTextWidth(colLabel) + 6;

      if (pillX + labelWidth > pageWidth - margin) {
        pillX = margin;
        pillY += 6;
        checkSpace(10);
      }

      doc.setFillColor(240, 253, 244);
      doc.rect(pillX, pillY - 3, labelWidth - 2, 4.5, 'F');
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(21, 128, 61);
      doc.text(colLabel, pillX + 2, pillY + 0.2);

      pillX += labelWidth;
    });

    y = pillY + 10;

    // --- Submissions Summary & Department Tracking Section ---
    const subList = submissions || [];
    const uploadedDeptIds = new Set(subList.map(s => s.department_id));
    const totalDeptsCount = departments.length || (subList.length > 0 ? subList.length : 1);
    const uploadedDeptsCount = subList.length;
    const remainingDepts = (departments || []).filter(d => d && d.id && !uploadedDeptIds.has(d.id));
    const remainingDeptsCount = remainingDepts.length;
    const percent = Math.min(1, Math.max(0, uploadedDeptsCount / totalDeptsCount));

    // Submission tracking progress header & progress bar
    checkSpace(35);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 138); // Navy
    doc.text("Department Submission Progress Tracking", margin, y);
    y += 5;

    // Progress bar outline/background
    doc.setFillColor(243, 244, 246); // slate-100
    doc.rect(margin, y, innerWidth, 4.5, 'F');
    
    // Progress fill
    if (percent > 0) {
      doc.setFillColor(34, 197, 94); // emerald-500
      doc.rect(margin, y, innerWidth * percent, 4.5, 'F');
    }
    
    // Progress text
    y += 8;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text(`Submission Status: ${uploadedDeptsCount} of ${totalDeptsCount} Departments Uploaded (${Math.round(percent * 100)}%)`, margin, y);
    y += 8;

    // Table 1: Successfully Uploaded Departments
    checkSpace(20);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(21, 128, 61); // Green-700
    doc.text(`Successfully Uploaded Departments (${uploadedDeptsCount})`, margin, y);
    y += 5;

    if (uploadedDeptsCount === 0) {
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(156, 163, 175);
      doc.text("No department submissions uploaded yet.", margin, y);
      y += 8;
    } else {
      checkSpace(12 + Math.min(5, uploadedDeptsCount) * 8);
      // Table Header
      doc.setFillColor(240, 253, 244); // light green bg
      doc.rect(margin, y, innerWidth, 6, 'F');
      doc.setDrawColor(222, 246, 228);
      doc.rect(margin, y, innerWidth, 6, 'S');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(21, 128, 61);
      doc.text("DEPARTMENT", margin + 3, y + 4.2);
      doc.text("SUBMITTED BY", margin + 65, y + 4.2);
      doc.text("FILE NAME", margin + 115, y + 4.2);
      doc.text("UPLOAD DATE", margin + 155, y + 4.2);
      
      y += 6;

      subList.forEach(sub => {
        checkSpace(8);
        doc.setDrawColor(240, 253, 244);
        doc.line(margin, y, pageWidth - margin, y);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(55, 65, 81);
        const deptLabel = `${sub.department?.code || 'Dept'} - ${sub.department?.name || ''}`;
        doc.text(deptLabel.length > 28 ? deptLabel.slice(0, 28) + '...' : deptLabel, margin + 3, y + 4.8);

        doc.setFont('Helvetica', 'normal');
        doc.text(sub.user?.full_name || 'Faculty', margin + 65, y + 4.8);
        doc.text(sub.file_name?.length > 22 ? sub.file_name.slice(0, 22) + '...' : sub.file_name || 'uploaded_sheet.xlsx', margin + 115, y + 4.8);
        doc.text(formatPdfDate(sub.created_at), margin + 155, y + 4.8);
        
        y += 7.5;
      });
    }

    y += 3;

    // Table 2: Remaining Departments (Pending Submission)
    checkSpace(20);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(180, 83, 9); // Amber-700
    doc.text(`Remaining / Pending Departments (${remainingDeptsCount})`, margin, y);
    y += 5;

    if (remainingDeptsCount === 0) {
      checkSpace(12);
      doc.setFillColor(240, 253, 244); // light green bg
      doc.rect(margin, y, innerWidth, 7, 'F');
      doc.setDrawColor(187, 247, 208);
      doc.rect(margin, y, innerWidth, 7, 'S');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(21, 128, 61); // Green-700
      doc.text("All academic departments have successfully uploaded their data spreadsheets!", margin + 5, y + 4.5);
      y += 10;
    } else {
      checkSpace(12 + Math.min(5, remainingDeptsCount) * 8);
      // Table Header
      doc.setFillColor(254, 243, 199); // amber-100 bg
      doc.rect(margin, y, innerWidth, 6, 'F');
      doc.setDrawColor(253, 230, 138);
      doc.rect(margin, y, innerWidth, 6, 'S');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(146, 64, 14); // Amber-800
      doc.text("DEPARTMENT CODE & NAME", margin + 3, y + 4.2);
      doc.text("STATUS", margin + 120, y + 4.2);
      doc.text("DUE DATE / REQUIREMENT", margin + 155, y + 4.2);
      
      y += 6;

      remainingDepts.forEach(dept => {
        checkSpace(8);
        doc.setDrawColor(254, 243, 199);
        doc.line(margin, y, pageWidth - margin, y);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(55, 65, 81);
        const deptLabel = `${dept.code || 'Dept'} - ${dept.name || ''}`;
        doc.text(deptLabel.length > 55 ? deptLabel.slice(0, 55) + '...' : deptLabel, margin + 3, y + 4.8);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(180, 83, 9); // Amber-700
        doc.text("Pending Submission", margin + 120, y + 4.8);

        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(156, 163, 175);
        doc.text("Required", margin + 155, y + 4.8);
        
        y += 7.5;
      });
    }
  }

  // --- Post-Process Page Footers ---
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(doc, i, totalPages);
  }

  // Save PDF
  const safeTitle = (meeting.agenda_title || 'meeting').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`Meeting_Report_${safeTitle}.pdf`);
}
