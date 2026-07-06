import { supabase } from './supabase';

/**
 * Automatically parses, categorizes, and inserts department agenda submissions
 * into operational database tables across all 7 categories:
 * 1. Fees Ingestion (student_fee_records)
 * 2. Weak Students Ingestion (weak_students)
 * 3. LMS Compliance (lms_activity)
 * 4. Attendance Ingestion (attendance_summary)
 * 5. Placement Ingestion (companies, placement_drives, placement_offers)
 * 6. End-Sem Results Ingestion (results table, exam_type: end_sem)
 * 7. Mid-Sem Academic Performance Ingestion (results table, exam_type: mid_term)
 */
export async function runAutomatedDataIngestion(meeting, submissions) {
  if (!submissions || submissions.length === 0) {
    console.log('No submissions available for database ingestion.');
    return { success: true, message: 'No data to ingest.' };
  }

  console.log(`Starting expanded automated ingestion for meeting "${meeting.agenda_title}" (ID: ${meeting.id})`);
  const logs = [];
  let recordsIngestedCount = 0;

  try {
    // 1. Fetch current academic year or use meeting's
    let academicYearId = meeting.academic_year_id;
    if (!academicYearId) {
      const { data: currentYear } = await supabase
        .from('academic_years')
        .select('id')
        .eq('is_current', true)
        .maybeSingle();
      academicYearId = currentYear?.id;
    }

    // 2. Fetch all students to match enrollment number (PEN No.) to student IDs
    const { data: students = [] } = await supabase
      .from('students')
      .select('id, enrollment_number, department_id');

    const studentMap = new Map();
    const studentDeptMap = new Map();
    students.forEach(s => {
      if (s.enrollment_number) {
        const pen = s.enrollment_number.trim().toUpperCase();
        studentMap.set(pen, s.id);
        studentDeptMap.set(pen, s.department_id);
      }
    });

    // 3. Fetch all subjects to resolve subject_id
    const { data: subjects = [] } = await supabase
      .from('subjects')
      .select('id, subject_code, subject_name, department_id');

    const subjectsByCode = new Map();
    const subjectsByName = new Map();
    subjects.forEach(sub => {
      if (sub.subject_code) subjectsByCode.set(sub.subject_code.trim().toUpperCase(), sub.id);
      if (sub.subject_name) subjectsByName.set(sub.subject_name.trim().toLowerCase(), sub.id);
    });

    // 4. Process each department's submission
    for (const sub of submissions) {
      if (!sub.submitted_data || !Array.isArray(sub.submitted_data) || sub.submitted_data.length === 0) {
        continue;
      }

      const rows = sub.submitted_data;
      const firstRow = rows[0];
      const headers = Object.keys(firstRow).map(h => h.trim().toUpperCase());

      // Helper function to match keys in a case-insensitive manner
      const getVal = (row, possibleKeys) => {
        const rowKeys = Object.keys(row);
        for (const k of rowKeys) {
          if (possibleKeys.includes(k.trim().toUpperCase())) {
            return row[k];
          }
        }
        return null;
      };

      // A. Identify Ingestion Target by Headers & Context
      const isFeesSpreadsheet = headers.includes('BALANCE') || 
                               headers.includes('TOTAL PAID') || 
                               headers.includes('TOTAL_PAID') || 
                               headers.includes('SCHOLARSHIP') ||
                               meeting.agenda_title.toUpperCase().includes('FEES') ||
                               meeting.agenda_title.toUpperCase().includes('FEE');

      const isWeakStudentsSpreadsheet = headers.includes('ACTION TAKEN') || 
                                       headers.includes('FURTHER IMPROVEMENT') ||
                                       meeting.agenda_title.toUpperCase().includes('WEAK STUDENT') ||
                                       meeting.agenda_title.toUpperCase().includes('WEAK_STUDENT');

      const isLMSSpreadsheet = headers.includes('ENGAGEMENT') || 
                               headers.includes('MOODLE') || 
                               headers.includes('UPLOADED_COURSES') ||
                               headers.includes('ACTIVE_STUDENTS') ||
                               headers.includes('TOTAL_COURSES') ||
                               meeting.agenda_title.toUpperCase().includes('LMS') ||
                               meeting.agenda_title.toUpperCase().includes('MOODLE');

      const isAttendanceSpreadsheet = headers.includes('ATTENDANCE_PERCENTAGE') || 
                                     headers.includes('ATTENDANCE %') || 
                                     headers.includes('ATTENDED_CLASSES') || 
                                     headers.includes('ATTENDANCE') ||
                                     meeting.agenda_title.toUpperCase().includes('ATTENDANCE');

      const isPlacementSpreadsheet = headers.includes('PLACEMENT') || 
                                    headers.includes('PACKAGE') || 
                                    headers.includes('CTC') || 
                                    headers.includes('COMPANY') ||
                                    headers.includes('COMPANY_NAME') ||
                                    meeting.agenda_title.toUpperCase().includes('PLACEMENT') ||
                                    meeting.agenda_title.toUpperCase().includes('PLACED');

      const isEndSemResultsSpreadsheet = headers.includes('SGPA') || 
                                        headers.includes('CGPA') || 
                                        headers.includes('END_SEM') || 
                                        headers.includes('END SEMESTER') ||
                                        meeting.agenda_title.toUpperCase().includes('END SEM') ||
                                        meeting.agenda_title.toUpperCase().includes('RESULTS');

      const isMidSemPerformanceSpreadsheet = !isEndSemResultsSpreadsheet && (
                                            headers.includes('MARKS') || 
                                            headers.includes('OBTAINED') || 
                                            headers.includes('MID_TERM') || 
                                            headers.includes('MID TERM') ||
                                            meeting.agenda_title.toUpperCase().includes('PERFORMANCE') ||
                                            meeting.agenda_title.toUpperCase().includes('MID SEM')
                                          );

      // B. Ingest Fees Records
      if (isFeesSpreadsheet) {
        const feeRecords = [];
        
        rows.forEach(row => {
          const pen = getVal(row, ['PEN NO.', 'PEN NO', 'ENROLLMENT NUMBER', 'ENROLLMENT_NUMBER', 'ENROLLMENT', 'STUDENT ID', 'STUDENT_ID']);
          if (!pen) return;

          const studentId = studentMap.get(String(pen).trim().toUpperCase());
          if (!studentId) {
            logs.push(`Fee Ingestion: Student with Enrollment No "${pen}" not found. Skipped row.`);
            return;
          }

          const total = Number(getVal(row, ['TOTAL FEE', 'TOTAL_FEE', 'TOTAL', 'FEE AMOUNT', 'FEE_AMOUNT']) || 120000);
          const paid = Number(getVal(row, ['TOTAL PAID', 'TOTAL_PAID', 'PAID', 'PAID AMOUNT', 'PAID_AMOUNT']) || 0);
          const scholarship = Number(getVal(row, ['SCHOLARSHIP', 'SCHOLARSHIP_AMOUNT', 'SCHOLARSHIP AMOUNT', 'CONCESSION']) || 0);
          const net = total - scholarship;
          const balance = net - paid;

          feeRecords.push({
            student_id: studentId,
            academic_year_id: academicYearId,
            semester: meeting.notes?.includes('Sem') ? parseInt(meeting.notes.match(/\d+/)?.[0] || 6) : 6,
            total_fee: total,
            scholarship_amount: scholarship,
            net_payable: net,
            total_paid: paid,
            balance: balance,
            status: balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending',
            last_payment_date: new Date().toISOString().split('T')[0]
          });
        });

        if (feeRecords.length > 0) {
          const { error } = await supabase.from('student_fee_records').upsert(feeRecords, { onConflict: 'student_id,academic_year_id,semester' });
          if (error) throw error;
          recordsIngestedCount += feeRecords.length;
          logs.push(`Fees Ingestion: Ingested ${feeRecords.length} student fee records.`);
        }
      }

      // C. Ingest Weak Students
      else if (isWeakStudentsSpreadsheet) {
        const weakRecords = [];

        rows.forEach(row => {
          const pen = getVal(row, ['PEN NO.', 'PEN NO', 'ENROLLMENT NUMBER', 'ENROLLMENT_NUMBER', 'ENROLLMENT', 'STUDENT ID', 'STUDENT_ID']);
          if (!pen) return;

          const studentId = studentMap.get(String(pen).trim().toUpperCase());
          if (!studentId) {
            logs.push(`Weak Student Ingestion: Student with Enrollment No "${pen}" not found. Skipped row.`);
            return;
          }

          const actionPlan = getVal(row, ['ACTION TAKEN', 'ACTION_TAKEN', 'REMARKS', 'COMMENTS', 'FEEDBACK']) || 'Remedial action plan details.';
          const improvement = getVal(row, ['FURTHER IMPROVEMENT', 'FURTHER_IMPROVEMENT', 'EXPECTED IMPROVEMENT']) || '';

          // Find which subject this relates to, or default to general backlogs
          const subjectVal = getVal(row, ['SUBJECT', 'SUBJECT_CODE', 'SUBJECT CODE', 'SUBJECT NAME', 'SUBJECT_NAME']);
          const subjectStr = subjectVal ? String(subjectVal).trim() : 'Academic Backlog';

          weakRecords.push({
            student_id: studentId,
            academic_year_id: academicYearId,
            reason: `Action Plan: ${actionPlan}. Further Improvement Expected: ${improvement}`,
            status: 'identified',
            identified_date: new Date().toISOString().split('T')[0],
            subjects_affected: [subjectStr]
          });
        });

        if (weakRecords.length > 0) {
          const { error } = await supabase.from('weak_students').insert(weakRecords);
          if (error) throw error;
          recordsIngestedCount += weakRecords.length;
          logs.push(`Weak Students Ingestion: Ingested ${weakRecords.length} weak student reports.`);
        }
      }

      // D. Ingest LMS Compliance
      else if (isLMSSpreadsheet) {
        const lmsRecords = [];
        
        // LMS is usually aggregate data per department
        const courses = Number(getVal(firstRow, ['COURSES', 'TOTAL COURSES', 'TOTAL_COURSES']) || 20);
        const uploaded = Number(getVal(firstRow, ['UPLOADED', 'UPLOADED COURSES', 'UPLOADED_COURSES', 'MATERIALS_UPLOADED']) || 15);
        const active = Number(getVal(firstRow, ['ACTIVE STUDENTS', 'ACTIVE_STUDENTS', 'STUDENTS']) || 100);
        const engagement = Number(getVal(firstRow, ['ENGAGEMENT', 'ENGAGEMENT_SCORE', 'AVERAGE ENGAGEMENT', 'AVG_ENGAGEMENT']) || 75);

        lmsRecords.push({
          department_id: sub.department_id,
          user_id: sub.submitted_by || meeting.created_by,
          academic_year_id: academicYearId,
          total_courses: courses,
          uploaded_courses: uploaded,
          active_students: active,
          engagement_score: engagement,
          last_upload_date: new Date().toISOString().split('T')[0]
        });

        if (lmsRecords.length > 0) {
          const { error } = await supabase.from('lms_activity').insert(lmsRecords);
          if (error) throw error;
          recordsIngestedCount += lmsRecords.length;
          logs.push(`LMS Ingestion: Uploaded compliance report for department HOD.`);
        }
      }

      // E. Ingest Attendance Summary
      else if (isAttendanceSpreadsheet) {
        const attendanceRecords = [];

        rows.forEach(row => {
          const pen = getVal(row, ['PEN NO.', 'PEN NO', 'ENROLLMENT NUMBER', 'ENROLLMENT_NUMBER', 'ENROLLMENT', 'STUDENT ID', 'STUDENT_ID']);
          if (!pen) return;

          const studentId = studentMap.get(String(pen).trim().toUpperCase());
          if (!studentId) {
            logs.push(`Attendance Ingestion: Student with Enrollment No "${pen}" not found. Skipped row.`);
            return;
          }

          const totalCl = Number(getVal(row, ['TOTAL CLASSES', 'TOTAL_CLASSES', 'CLASSES HELD', 'TOTAL']) || 40);
          const attendedCl = Number(getVal(row, ['ATTENDED CLASSES', 'ATTENDED_CLASSES', 'CLASSES ATTENDED', 'ATTENDED']) || 30);
          const pct = Number(getVal(row, ['ATTENDANCE PERCENTAGE', 'ATTENDANCE %', 'ATTENDANCE_PERCENTAGE', 'ATTENDANCE']) || Math.round((attendedCl / totalCl) * 100));

          // Resolve Subject ID
          const subKey = getVal(row, ['SUBJECT CODE', 'SUBJECT_CODE', 'SUBJECT', 'SUBJECT NAME', 'SUBJECT_NAME']);
          let subjectId = null;
          if (subKey) {
            const cleanSubKey = String(subKey).trim().toUpperCase();
            subjectId = subjectsByCode.get(cleanSubKey) || subjectsByName.get(cleanSubKey.toLowerCase());
          }
          // Default to first subject of department if still null
          if (!subjectId) {
            const deptId = studentDeptMap.get(String(pen).trim().toUpperCase()) || sub.department_id;
            const deptSub = subjects.find(s => s.department_id === deptId);
            subjectId = deptSub?.id;
          }

          if (!subjectId) {
            logs.push(`Attendance Ingestion: No matching subject found for "${subKey || 'General'}". Skipped row.`);
            return;
          }

          attendanceRecords.push({
            student_id: studentId,
            subject_id: subjectId,
            academic_year_id: academicYearId,
            semester: meeting.notes?.includes('Sem') ? parseInt(meeting.notes.match(/\d+/)?.[0] || 6) : 6,
            total_classes: totalCl,
            attended_classes: attendedCl,
            attendance_percentage: pct,
            last_updated: new Date().toISOString()
          });
        });

        if (attendanceRecords.length > 0) {
          const { error } = await supabase.from('attendance_summary').upsert(attendanceRecords, { onConflict: 'student_id,subject_id,academic_year_id' });
          if (error) throw error;
          recordsIngestedCount += attendanceRecords.length;
          logs.push(`Attendance Ingestion: Ingested ${attendanceRecords.length} student attendance logs.`);
        }
      }

      // F. Ingest Placements
      else if (isPlacementSpreadsheet) {
        for (const row of rows) {
          const companyName = getVal(row, ['COMPANY', 'COMPANY NAME', 'COMPANY_NAME', 'EMPLOYER']);
          if (!companyName) continue;

          // 1. Resolve Company
          let { data: company } = await supabase
            .from('companies')
            .select('id')
            .eq('company_name', String(companyName).trim())
            .maybeSingle();

          if (!company) {
            const { data: newCompany, error: compErr } = await supabase
              .from('companies')
              .insert({
                company_name: String(companyName).trim(),
                industry: getVal(row, ['INDUSTRY', 'SECTOR', 'COMPANY_TYPE']) || 'IT / Software Services',
                company_type: getVal(row, ['TYPE']) || 'Private'
              })
              .select('id')
              .single();
            if (compErr) throw compErr;
            company = newCompany;
            logs.push(`Placements: Created new company record for "${companyName}".`);
          }

          // 2. Resolve Drive
          const driveDate = getVal(row, ['DATE', 'DRIVE_DATE', 'PLACEMENT_DATE']) || new Date().toISOString().split('T')[0];
          const role = getVal(row, ['ROLE', 'DESIGNATION', 'JOB_ROLE']) || 'Software Developer';
          const ctcVal = Number(getVal(row, ['PACKAGE', 'CTC', 'PACKAGE_CTC', 'SALARY']) || 4.5);

          let { data: drive } = await supabase
            .from('placement_drives')
            .select('id')
            .eq('company_id', company.id)
            .eq('drive_date', driveDate)
            .maybeSingle();

          if (!drive) {
            const { data: newDrive, error: driveErr } = await supabase
              .from('placement_drives')
              .insert({
                company_id: company.id,
                drive_date: driveDate,
                roles_offered: role,
                package_range: `${ctcVal} LPA`,
                visit_type: 'on_campus'
              })
              .select('id')
              .single();
            if (driveErr) throw driveErr;
            drive = newDrive;
            logs.push(`Placements: Scheduled placement drive for "${companyName}".`);
          }

          // 3. Resolve Offer
          const pen = getVal(row, ['PEN NO.', 'PEN NO', 'ENROLLMENT NUMBER', 'ENROLLMENT_NUMBER', 'ENROLLMENT', 'STUDENT ID', 'STUDENT_ID']);
          if (pen) {
            const studentId = studentMap.get(String(pen).trim().toUpperCase());
            if (!studentId) {
              logs.push(`Placement Ingestion: Student with Enrollment No "${pen}" not found. Skipped offer entry.`);
              continue;
            }

            const offerData = {
              student_id: studentId,
              company_id: company.id,
              drive_id: drive.id,
              role: role,
              package_ctc: ctcVal,
              joining_date: new Date(new Date().getFullYear(), 6, 1).toISOString().split('T')[0], // Default July 1
              acceptance_status: 'accepted',
              joining_confirmed: true
            };

            const { error: offerErr } = await supabase.from('placement_offers').insert(offerData);
            if (offerErr) throw offerErr;
            recordsIngestedCount++;
            logs.push(`Placements: Logged placement offer at ${companyName} for Enrollment No "${pen}".`);
          }
        }
      }

      // G. Ingest End-Sem Results
      else if (isEndSemResultsSpreadsheet) {
        const resultsRecords = [];

        rows.forEach(row => {
          const pen = getVal(row, ['PEN NO.', 'PEN NO', 'ENROLLMENT NUMBER', 'ENROLLMENT_NUMBER', 'ENROLLMENT', 'STUDENT ID', 'STUDENT_ID']);
          if (!pen) return;

          const studentId = studentMap.get(String(pen).trim().toUpperCase());
          if (!studentId) {
            logs.push(`Results End-Sem Ingestion: Student with Enrollment No "${pen}" not found. Skipped row.`);
            return;
          }

          const sgpa = Number(getVal(row, ['SGPA', 'GPA', 'SGPA_OBTAINED']) || 7.0);
          const cgpa = Number(getVal(row, ['CGPA', 'CGPA_OBTAINED']) || 7.0);

          resultsRecords.push({
            student_id: studentId,
            academic_year_id: academicYearId,
            exam_type: 'end_sem',
            sgpa: sgpa,
            cgpa: cgpa,
            exam_date: new Date().toISOString().split('T')[0]
          });
        });

        if (resultsRecords.length > 0) {
          const { error } = await supabase.from('results').insert(resultsRecords);
          if (error) throw error;
          recordsIngestedCount += resultsRecords.length;
          logs.push(`End-Sem Results Ingestion: Synthesized and uploaded ${resultsRecords.length} GPA reports.`);
        }
      }

      // H. Ingest Mid-Sem Academic Performance
      else if (isMidSemPerformanceSpreadsheet) {
        const resultsRecords = [];

        rows.forEach(row => {
          const pen = getVal(row, ['PEN NO.', 'PEN NO', 'ENROLLMENT NUMBER', 'ENROLLMENT_NUMBER', 'ENROLLMENT', 'STUDENT ID', 'STUDENT_ID']);
          if (!pen) return;

          const studentId = studentMap.get(String(pen).trim().toUpperCase());
          if (!studentId) {
            logs.push(`Performance Mid-Sem Ingestion: Student with Enrollment No "${pen}" not found. Skipped row.`);
            return;
          }

          const obtained = Number(getVal(row, ['MARKS OBTAINED', 'MARKS_OBTAINED', 'MARKS', 'OBTAINED', 'SCORE']) || 75);
          const total = Number(getVal(row, ['TOTAL MARKS', 'TOTAL_MARKS', 'TOTAL', 'MAX_MARKS']) || 100);

          // Resolve Subject ID
          const subKey = getVal(row, ['SUBJECT CODE', 'SUBJECT_CODE', 'SUBJECT', 'SUBJECT NAME', 'SUBJECT_NAME']);
          let subjectId = null;
          if (subKey) {
            const cleanSubKey = String(subKey).trim().toUpperCase();
            subjectId = subjectsByCode.get(cleanSubKey) || subjectsByName.get(cleanSubKey.toLowerCase());
          }
          if (!subjectId) {
            const deptId = studentDeptMap.get(String(pen).trim().toUpperCase()) || sub.department_id;
            const deptSub = subjects.find(s => s.department_id === deptId);
            subjectId = deptSub?.id;
          }

          if (!subjectId) {
            logs.push(`Performance Mid-Sem Ingestion: No matching subject found for "${subKey || 'General'}". Skipped row.`);
            return;
          }

          resultsRecords.push({
            student_id: studentId,
            subject_id: subjectId,
            academic_year_id: academicYearId,
            exam_type: 'mid_term',
            marks_obtained: obtained,
            total_marks: total,
            grade: obtained >= 90 ? 'O' : obtained >= 80 ? 'A+' : obtained >= 70 ? 'A' : obtained >= 60 ? 'B' : obtained >= 50 ? 'C' : 'F',
            exam_date: new Date().toISOString().split('T')[0]
          });
        });

        if (resultsRecords.length > 0) {
          const { error } = await supabase.from('results').insert(resultsRecords);
          if (error) throw error;
          recordsIngestedCount += resultsRecords.length;
          logs.push(`Mid-Sem Performance Ingestion: Ingested ${resultsRecords.length} subject performance scores.`);
        }
      }
    }

    return {
      success: true,
      recordsIngested: recordsIngestedCount,
      logs: logs
    };
  } catch (err) {
    console.error('Data Ingestion Engine error:', err);
    return {
      success: false,
      error: err.message,
      logs: logs
    };
  }
}
