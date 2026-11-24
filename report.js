import { clearReports, loadReports, saveReport } from './storage.js';

function formatReportDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export class ReportController {
  constructor({ dispensers, onToast, onResetDemoData }) {
    this.dispensers = dispensers;
    this.onToast = onToast || (() => {});
    this.onResetDemoData = onResetDemoData || (() => {});
    this.reports = loadReports();

    this.form = document.getElementById('reportForm');
    this.dispenserSelect = document.getElementById('reportDispenser');
    this.issueTypeSelect = document.getElementById('reportIssueType');
    this.descriptionInput = document.getElementById('reportDescription');
    this.charCountEl = document.getElementById('charCount');
    this.listEl = document.getElementById('recentReportsList');
    this.countPillEl = document.getElementById('reportCountPill');
    this.resetDemoBtn = document.getElementById('resetDemoDataBtn');

    this.errorDispenser = document.getElementById('errorDispenser');
    this.errorIssueType = document.getElementById('errorIssueType');
    this.errorDescription = document.getElementById('errorDescription');
  }

  init() {
    this.populateDispenserOptions();
    this.renderReports();
    this.bindEvents();
  }

  updateDispensers(dispensers) {
    this.dispensers = dispensers;
    this.populateDispenserOptions();
  }

  populateDispenserOptions() {
    if (!this.dispenserSelect) return;
    this.dispenserSelect.innerHTML = '<option value="">-- Choose a dispenser --</option>';
    this.dispensers.forEach((d) => {
      const option = document.createElement('option');
      option.value = d.id;
      option.textContent = `${d.name} (${d.building})`;
      this.dispenserSelect.appendChild(option);
    });
  }

  preselectDispenser(dispenserId) {
    if (!this.dispenserSelect) return;
    this.dispenserSelect.value = dispenserId;
    this.clearErrors();
    const reportSection = document.getElementById('report');
    if (reportSection) {
      reportSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.issueTypeSelect?.focus();
  }

  bindEvents() {
    this.descriptionInput?.addEventListener('input', () => {
      const len = this.descriptionInput.value.length;
      if (this.charCountEl) {
        this.charCountEl.textContent = `${len} / 400`;
      }
    });

    this.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleSubmit();
    });

    this.resetDemoBtn?.addEventListener('click', () => {
      this.reports = clearReports();
      this.renderReports();
      this.onResetDemoData();
      this.onToast('Demo data and saved reports have been restored to original state.', 'success');
    });
  }

  clearErrors() {
    if (this.errorDispenser) this.errorDispenser.textContent = '';
    if (this.errorIssueType) this.errorIssueType.textContent = '';
    if (this.errorDescription) this.errorDescription.textContent = '';
  }

  validate() {
    this.clearErrors();
    let valid = true;

    const dispenserId = this.dispenserSelect?.value.trim() || '';
    const issueType = this.issueTypeSelect?.value.trim() || '';
    const description = this.descriptionInput?.value.trim() || '';

    if (!dispenserId) {
      if (this.errorDispenser) this.errorDispenser.textContent = 'Please select a water dispenser.';
      valid = false;
    }

    if (!issueType) {
      if (this.errorIssueType) this.errorIssueType.textContent = 'Please select the type of problem.';
      valid = false;
    }

    if (description.length < 8) {
      if (this.errorDescription) {
        this.errorDescription.textContent = 'Please provide at least 8 characters describing the issue.';
      }
      valid = false;
    }

    return { valid, dispenserId, issueType, description };
  }

  handleSubmit() {
    const { valid, dispenserId, issueType, description } = this.validate();
    if (!valid) return;

    const matched = this.dispensers.find((d) => d.id === dispenserId);
    if (!matched) {
      if (this.errorDispenser) this.errorDispenser.textContent = 'Selected dispenser not found.';
      return;
    }

    const newReport = {
      id: `REP-${Date.now()}`,
      dispenserId: matched.id,
      dispenserName: matched.name,
      issueType,
      description,
      createdAt: new Date().toISOString(),
      verificationStatus: 'Pending Verification'
    };

    this.reports = saveReport(newReport);
    this.renderReports();
    this.form.reset();
    if (this.charCountEl) {
      this.charCountEl.textContent = '0 / 400';
    }

    this.onToast(
      `Report logged for ${matched.name}. Saved locally (Pending Verification).`,
      'success'
    );
  }

  renderReports() {
    if (!this.listEl || !this.countPillEl) return;

    const total = this.reports.length;
    this.countPillEl.textContent = `${total} ${total === 1 ? 'Report' : 'Reports'}`;
    this.listEl.innerHTML = '';

    if (total === 0) {
      const empty = document.createElement('div');
      empty.className = 'reports-empty';
      empty.textContent =
        'No issues reported yet. Submit a report on the left to log a maintenance entry.';
      this.listEl.appendChild(empty);
      return;
    }

    this.reports.forEach((report) => {
      const item = document.createElement('article');
      item.className = 'report-item';

      const top = document.createElement('div');
      top.className = 'report-item-top';

      const nameEl = document.createElement('span');
      nameEl.className = 'report-station-name';
      nameEl.textContent = report.dispenserName;

      const issueEl = document.createElement('span');
      issueEl.className = 'report-issue-badge';
      issueEl.textContent = report.issueType;

      top.appendChild(nameEl);
      top.appendChild(issueEl);

      const descEl = document.createElement('p');
      descEl.className = 'report-desc';
      descEl.textContent = report.description;

      const footer = document.createElement('div');
      footer.className = 'report-item-footer';

      const dateEl = document.createElement('span');
      dateEl.textContent = formatReportDate(report.createdAt);

      const statusEl = document.createElement('span');
      statusEl.className = 'pending-tag';
      statusEl.textContent = `${report.verificationStatus || 'Pending Verification'} • Unverified`;

      footer.appendChild(dateEl);
      footer.appendChild(statusEl);

      item.appendChild(top);
      item.appendChild(descEl);
      item.appendChild(footer);

      this.listEl.appendChild(item);
    });
  }
}
