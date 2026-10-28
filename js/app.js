/**
 * TÍCH TIỂU THÀNH ĐẠI - LOGIC QUẢN LÝ QUỸ MỤC TIÊU TIỀN HÀNG NGÀY
 */

(function () {
  'use strict';

  // --- STORAGE KEYS ---
  const STORAGE_KEY_FUNDS = 'tttd_funds_data_clean';
  const STORAGE_KEY_ACTIVE = 'tttd_active_fund_clean';
  const STORAGE_KEY_THEME = 'tttd_user_theme';
  const STORAGE_KEY_SOUND = 'tttd_sound_setting';
  const STORAGE_KEY_SYNC_CONFIG = 'tttd_sync_config_v1';

  // --- CIRCUMFERENCE CONSTANT FOR 82px RADIUS SVG CIRCLE ---
  const CIRCLE_RADIUS = 82;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS; // ~515.221

  // --- STATE ---
  let funds = [];
  let activeFundId = null;
  let soundEnabled = true;

  // --- CLOUD SYNC STATE ---
  let syncConfig = {
    enabled: false,
    dbUrl: '',
    pin: '',
    lastSyncTime: null
  };
  let eventSourceInstance = null;
  let lastLocalPushTimestamp = 0;

  // --- AUDIO SYNTHESIZER (Web Audio API) ---
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playCoinSound() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Coin chime frequencies (B5 to E6)
      osc.frequency.setValueAtTime(987.77, ctx.currentTime);
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  function playMilestoneSound() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);

        gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.4);
      });
    } catch (e) {
      console.warn('Milestone audio error:', e);
    }
  }

  // --- CONFETTI CELEBRATION ---
  function triggerConfetti(milestone = false) {
    if (typeof confetti !== 'function') return;

    if (milestone) {
      // Big celebration
      const count = 200;
      const defaults = {
        origin: { y: 0.7 }
      };

      function fire(particleRatio, opts) {
        confetti(Object.assign({}, defaults, opts, {
          particleCount: Math.floor(count * particleRatio)
        }));
      }

      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    } else {
      // Gentle mini confetti
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#10b981', '#06b6d4', '#f59e0b', '#ffffff']
      });
    }
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = 'info', iconClass = 'fa-solid fa-circle-info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="${iconClass}"></i>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastSlideOut 0.3s ease forwards';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3200);
  }

  // --- HELPER FUNCTIONS ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatMoney(amount) {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' ₫';
  }

  function parseFormattedNumber(val) {
    if (!val) return 0;
    // Strip everything except numbers and minus sign
    const cleaned = String(val).replace(/[^\d-]/g, '');
    return parseInt(cleaned, 10) || 0;
  }

  function formatInputCurrency(inputEl) {
    const cursorPosition = inputEl.selectionStart;
    const originalLength = inputEl.value.length;
    const rawVal = parseFormattedNumber(inputEl.value);

    if (rawVal === 0 && inputEl.value.trim() === '') {
      inputEl.value = '';
      return;
    }

    inputEl.value = new Intl.NumberFormat('vi-VN').format(rawVal);
    // adjust cursor position
    const newLength = inputEl.value.length;
    const newPos = Math.max(0, cursorPosition + (newLength - originalLength));
    inputEl.setSelectionRange(newPos, newPos);
  }

  function formatDateVietnamese(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  function getTodayString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  // --- LOCAL STORAGE HANDLING ---
  function loadFundsFromStorage() {
    // Xóa sạch các dữ liệu mẫu hoặc key cũ trước đây
    try {
      ['tttd_funds_data_v1', 'tttd_active_fund_id', 'tttd_funds_data_v2', 'tttd_active_fund_id_v2'].forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (e) {}

    try {
      const data = localStorage.getItem(STORAGE_KEY_FUNDS);
      if (data) {
        funds = JSON.parse(data);
      } else {
        funds = [];
      }
    } catch (e) {
      console.error('Failed to load funds from storage', e);
      funds = [];
    }

    const savedActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE);
    if (savedActiveId && funds.some(f => f.id === savedActiveId)) {
      activeFundId = savedActiveId;
    } else if (funds.length > 0) {
      activeFundId = funds[0].id;
    } else {
      activeFundId = null;
    }

    // Sound setting
    const savedSound = localStorage.getItem(STORAGE_KEY_SOUND);
    soundEnabled = savedSound !== 'false';

    // Theme setting
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'theme-dark';
    document.body.className = savedTheme;
    updateThemeButtonIcon();
    updateSoundButtonIcon();
  }

  function saveFundsToStorage(skipCloudPush = false) {
    try {
      localStorage.setItem(STORAGE_KEY_FUNDS, JSON.stringify(funds));
      if (activeFundId) {
        localStorage.setItem(STORAGE_KEY_ACTIVE, activeFundId);
      } else {
        localStorage.removeItem(STORAGE_KEY_ACTIVE);
      }
    } catch (e) {
      console.error('Failed to save to localStorage', e);
      showToast('Bộ nhớ trình duyệt đầy, không thể lưu dữ liệu!', 'error');
    }

    if (!skipCloudPush && syncConfig && syncConfig.enabled) {
      pushFundsToCloud();
    }
  }

  function getActiveFund() {
    return funds.find(f => f.id === activeFundId) || null;
  }

  // --- STREAK CALCULATION ---
  function calculateStreak(fund) {
    if (!fund || !fund.entries || fund.entries.length === 0) return 0;

    // Get unique dates with income entries
    const dates = Array.from(
      new Set(
        fund.entries
          .filter(e => e.type === 'income' && e.amount > 0)
          .map(e => e.date)
      )
    ).sort().reverse(); // Newest first

    if (dates.length === 0) return 0;

    const todayStr = getTodayString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Must have logged today or yesterday to maintain active streak
    if (dates[0] !== todayStr && dates[0] !== yesterdayStr) {
      return 0;
    }

    let streak = 0;
    let expectedDate = new Date(dates[0]);

    for (let i = 0; i < dates.length; i++) {
      const entryDate = new Date(dates[i]);
      const diffDays = Math.round((expectedDate - entryDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        streak++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  // --- RENDER FUNCTIONS ---

  function renderFundsNavigation() {
    const navListEl = document.getElementById('funds-nav-list');
    const countBadgeEl = document.getElementById('funds-count');
    if (!navListEl) return;

    navListEl.innerHTML = '';
    countBadgeEl.textContent = `${funds.length} quỹ`;

    if (funds.length === 0) {
      document.getElementById('active-fund-dashboard').style.display = 'none';
      document.getElementById('no-fund-placeholder').classList.remove('hidden');
      return;
    }

    document.getElementById('active-fund-dashboard').style.display = 'block';
    document.getElementById('no-fund-placeholder').classList.add('hidden');

    funds.forEach(fund => {
      const total = (fund.entries || []).reduce((sum, item) => sum + item.amount, 0);
      const pct = fund.target > 0 ? (total / fund.target) * 100 : 0;
      const isActive = fund.id === activeFundId;

      const pill = document.createElement('div');
      pill.className = `fund-pill-tab ${isActive ? 'active' : ''}`;
      pill.dataset.fundId = fund.id;
      pill.setAttribute('role', 'button');
      pill.setAttribute('tabindex', '0');

      pill.innerHTML = `
        <div class="pill-icon">${fund.icon || '🎯'}</div>
        <div class="pill-details">
          <div class="pill-name" title="${escapeHtml(fund.name)}">${escapeHtml(fund.name)}</div>
          <div class="pill-money-meta">
            <span>${formatMoney(total)}</span>
            <span class="pill-percent">${pct.toFixed(1)}%</span>
          </div>
        </div>
      `;

      pill.addEventListener('click', () => {
        if (activeFundId !== fund.id) {
          activeFundId = fund.id;
          saveFundsToStorage();
          renderApp();
        }
      });

      navListEl.appendChild(pill);
    });
  }

  function renderActiveFundDashboard() {
    const fund = getActiveFund();
    if (!fund) return;

    // Header Info
    document.getElementById('card-fund-icon').textContent = fund.icon || '🎯';
    document.getElementById('card-fund-name').textContent = fund.name;
    document.getElementById('card-fund-category').textContent = fund.category || 'Mục tiêu tài chính';
    document.getElementById('card-fund-desc').textContent = fund.description || 'Chưa có lời nhắn nhủ';

    // Financial calculations
    const entries = fund.entries || [];
    const totalAccumulated = entries.reduce((sum, item) => sum + item.amount, 0);
    const targetMoney = fund.target || 0;
    const remainingMoney = Math.max(0, targetMoney - totalAccumulated);
    const percent = targetMoney > 0 ? (totalAccumulated / targetMoney) * 100 : 0;
    const formattedPercent = percent.toFixed(1);

    // Cards Values
    document.getElementById('metric-current-money').textContent = formatMoney(totalAccumulated);
    document.getElementById('metric-target-money').textContent = formatMoney(targetMoney);
    document.getElementById('metric-remaining-money').textContent = formatMoney(remainingMoney);
    document.getElementById('metric-entries-count').textContent = `${entries.length} lần giao dịch`;
    document.getElementById('target-summary-label').textContent = `Mục tiêu: ${formatMoney(targetMoney)}`;

    if (fund.deadline) {
      document.getElementById('metric-target-date').textContent = `Hạn chót: ${formatDateVietnamese(fund.deadline)}`;
    } else {
      document.getElementById('metric-target-date').textContent = 'Chưa đặt hạn chót';
    }

    // Pace & status badge
    const statusBadgeEl = document.getElementById('progress-status-badge');
    const milestoneHintEl = document.getElementById('progress-milestone-hint');
    const paceEstimateEl = document.getElementById('metric-pace-estimate');

    if (percent >= 100) {
      statusBadgeEl.textContent = 'Đã Đạt Mục Tiêu 🎉';
      statusBadgeEl.style.color = 'var(--accent-gold)';
      milestoneHintEl.textContent = `Tuyệt vời! Bạn đã hoàn thành 100% mục tiêu!`;
      paceEstimateEl.textContent = 'Mục tiêu đã cán đích thành công!';
    } else if (percent >= 75) {
      statusBadgeEl.textContent = 'Gần Cán Đích 🚀';
      statusBadgeEl.style.color = 'var(--primary-emerald)';
      milestoneHintEl.textContent = `Chỉ còn ${formatMoney(remainingMoney)} nữa thôi, cố lên!`;
      paceEstimateEl.textContent = 'Đang ở chặng nước rút!';
    } else if (percent >= 50) {
      statusBadgeEl.textContent = 'Đã Qua Nửa Chặng ⚡';
      statusBadgeEl.style.color = 'var(--accent-cyan)';
      milestoneHintEl.textContent = `Đã đi được ${formattedPercent}% chặng đường!`;
      paceEstimateEl.textContent = 'Duy trì tiến độ rất tốt!';
    } else if (percent > 0) {
      statusBadgeEl.textContent = 'Đang Tích Luỹ 📈';
      statusBadgeEl.style.color = 'var(--text-muted)';
      milestoneHintEl.textContent = `Đã tích luỹ ${formattedPercent}% mục tiêu`;
      paceEstimateEl.textContent = 'Tích tiểu thành đại!';
    } else {
      statusBadgeEl.textContent = 'Bắt Đầu 🌱';
      statusBadgeEl.style.color = 'var(--text-dim)';
      milestoneHintEl.textContent = 'Hãy ghi nhận khoản tiền nạp đầu tiên!';
      paceEstimateEl.textContent = 'Bắt đầu hành trình ngay hôm nay';
    }

    // Radial Progress Circle animation
    const progressCircle = document.getElementById('progress-circle');
    const progressText = document.getElementById('progress-percentage');
    progressText.textContent = `${formattedPercent}%`;

    const clampedPercent = Math.min(100, Math.max(0, percent));
    const offset = CIRCLE_CIRCUMFERENCE - (clampedPercent / 100) * CIRCLE_CIRCUMFERENCE;
    progressCircle.style.strokeDashoffset = offset;

    // Linear Bar animation
    const linearBar = document.getElementById('linear-progress-bar');
    const glowPoint = document.getElementById('progress-glow-point');
    linearBar.style.width = `${clampedPercent}%`;
    glowPoint.style.left = `${clampedPercent}%`;

    // Streak mini card
    const streakDays = calculateStreak(fund);
    const streakTitleEl = document.getElementById('streak-title');
    const streakDescEl = document.getElementById('streak-desc');
    streakTitleEl.textContent = `Chuỗi tích lũy: ${streakDays} ngày liên tiếp 🔥`;
    if (streakDays >= 7) {
      streakDescEl.textContent = 'Kỷ luật thép! Bạn đang duy trì thói quen tích luỹ vô cùng xuất sắc!';
    } else if (streakDays >= 3) {
      streakDescEl.textContent = 'Phong độ rất tốt! Hãy tiếp tục duy trì nhé!';
    } else if (streakDays > 0) {
      streakDescEl.textContent = 'Khởi đầu tuyệt vời! Hãy tiếp tục nạp thêm khi có thu nhập mới!';
    } else {
      streakDescEl.textContent = 'Ghi nhận giao dịch nạp tiền để theo dõi chuỗi tích luỹ!';
    }

    // Milestones track
    const milestoneNodes = document.querySelectorAll('.milestone-node');
    const milestoneLines = document.querySelectorAll('.milestone-line');
    milestoneNodes.forEach((node, idx) => {
      const nodePct = parseInt(node.dataset.percent, 10);
      if (percent >= nodePct) {
        node.classList.add('reached');
      } else {
        node.classList.remove('reached');
      }
    });

    milestoneLines.forEach((line, idx) => {
      const thresholds = [25, 50, 75];
      if (percent >= thresholds[idx]) {
        line.classList.add('reached');
      } else {
        line.classList.remove('reached');
      }
    });

    // Analytics calculations
    renderAnalytics(fund, totalAccumulated, remainingMoney);

    // Render Entries list
    renderEntriesList(fund);
  }

  function renderAnalytics(fund, totalAccumulated, remainingMoney) {
    const incomeEntries = (fund.entries || []).filter(e => (e.type === 'income' || (!e.type && e.amount > 0)) && e.amount > 0);

    const statAvgEl = document.getElementById('stat-avg-deposit');
    const statAvgSub = document.getElementById('stat-avg-sub');
    const statDepositsEl = document.getElementById('stat-deposits-needed');
    const statDepositsSub = document.getElementById('stat-deposits-sub');
    const statMaxEl = document.getElementById('stat-max-entry');
    const statMaxSub = document.getElementById('stat-max-sub');
    const statDeadlineLabel = document.getElementById('stat-deadline-label');
    const statEtaEl = document.getElementById('stat-eta-date');
    const statEtaSub = document.getElementById('stat-eta-sub');

    if (!statAvgEl) return;

    const count = incomeEntries.length;
    const totalIncome = incomeEntries.reduce((sum, item) => sum + item.amount, 0);

    if (count === 0) {
      statAvgEl.textContent = '0 ₫';
      if (statAvgSub) statAvgSub.textContent = 'Chưa có lượt nạp tiền nào';
      if (statDepositsEl) statDepositsEl.textContent = '-- lần';
      if (statDepositsSub) statDepositsSub.textContent = 'Cần nạp thêm để ước tính';
      if (statMaxEl) statMaxEl.textContent = '0 ₫';
      if (statMaxSub) statMaxSub.textContent = 'Kỷ lục trong 1 lần nạp';
    } else {
      const avgPerDeposit = totalIncome / count;
      statAvgEl.textContent = formatMoney(avgPerDeposit);
      if (statAvgSub) {
        statAvgSub.textContent = count === 1 ? 'Dựa trên 1 lần nạp tiền' : `Bình quân trên ${count} lần nạp`;
      }

      if (remainingMoney <= 0) {
        if (statDepositsEl) statDepositsEl.textContent = '0 lần 🎉';
        if (statDepositsSub) statDepositsSub.textContent = 'Mục tiêu đã hoàn tất 100%';
      } else {
        const depositsNeeded = Math.ceil(remainingMoney / avgPerDeposit);
        if (statDepositsEl) statDepositsEl.textContent = `Khoảng ${depositsNeeded} lần`;
        if (statDepositsSub) statDepositsSub.textContent = `Nếu duy trì ~${formatMoney(avgPerDeposit)}/lần`;
      }

      const maxEntry = Math.max(...incomeEntries.map(e => e.amount));
      if (statMaxEl) statMaxEl.textContent = formatMoney(maxEntry);
      if (statMaxSub) statMaxSub.textContent = 'Kỷ lục trong 1 lần nạp';
    }

    // Deadline & Kế hoạch thời gian (Không tự tiện suy diễn ngày hoàn thành khi không có hạn chót)
    if (remainingMoney <= 0) {
      if (statDeadlineLabel) statDeadlineLabel.textContent = 'Trạng thái';
      if (statEtaEl) statEtaEl.textContent = 'Đã Hoàn Thành 🎊';
      if (statEtaSub) statEtaSub.textContent = 'Cán đích mục tiêu 100%';
    } else if (fund.deadline) {
      if (statDeadlineLabel) statDeadlineLabel.textContent = 'Hạn chót mục tiêu';
      if (statEtaEl) statEtaEl.textContent = formatDateVietnamese(fund.deadline);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadlineDate = new Date(fund.deadline + 'T00:00:00');
      const diffDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));

      if (statEtaSub) {
        if (diffDays > 0) {
          const suggestedDaily = Math.round(remainingMoney / diffDays);
          statEtaSub.textContent = `Còn ${diffDays} ngày (Gợi ý: ~${formatMoney(suggestedDaily)}/ngày để kịp hạn)`;
        } else if (diffDays === 0) {
          statEtaSub.textContent = 'Hạn chót là hôm nay!';
        } else {
          statEtaSub.textContent = `Đã qua hạn ${Math.abs(diffDays)} ngày`;
        }
      }
    } else {
      if (statDeadlineLabel) statDeadlineLabel.textContent = 'Kế hoạch thời gian';
      if (statEtaEl) statEtaEl.textContent = 'Linh hoạt';
      if (statEtaSub) statEtaSub.textContent = 'Tự do tích lũy, không áp lực ngày';
    }
  }

  function renderEntriesList(fund) {
    const container = document.getElementById('entries-list-container');
    const summaryText = document.getElementById('history-summary-text');
    const filterInput = document.getElementById('filter-history-input');
    const filterKeyword = (filterInput ? filterInput.value.trim().toLowerCase() : '');

    if (!container) return;

    let entries = [...(fund.entries || [])].sort((a, b) => {
      // Sort newest date first, then timestamp
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    if (filterKeyword) {
      entries = entries.filter(e => 
        (e.note && e.note.toLowerCase().includes(filterKeyword)) ||
        formatDateVietnamese(e.date).includes(filterKeyword) ||
        String(e.amount).includes(filterKeyword)
      );
    }

    summaryText.textContent = `${entries.length} giao dịch ghi nhận`;
    container.innerHTML = '';

    if (entries.length === 0) {
      container.innerHTML = `
        <div class="empty-entries-view">
          <i class="fa-solid fa-receipt"></i>
          <p>Chưa có lượt đánh dấu tiền nào${filterKeyword ? ' khớp với tìm kiếm' : ''}.</p>
        </div>
      `;
      return;
    }

    entries.forEach(item => {
      const isIncome = item.type === 'income' || item.amount >= 0;
      const el = document.createElement('div');
      el.className = `entry-item ${isIncome ? 'income' : 'withdraw'}`;
      
      const sign = isIncome ? '+' : '-';
      const absAmount = Math.abs(item.amount);

      el.innerHTML = `
        <div class="entry-left">
          <div class="entry-badge-icon">
            <i class="${isIncome ? 'fa-solid fa-arrow-down-long' : 'fa-solid fa-arrow-up-long'}"></i>
          </div>
          <div class="entry-info">
            <div class="entry-note" title="${escapeHtml(item.note || (isIncome ? 'Nạp tiền tích lũy' : 'Rút bớt'))}">
              ${escapeHtml(item.note || (isIncome ? 'Nạp tiền tích lũy' : 'Rút bớt'))}
            </div>
            <div class="entry-date-note">
              <span class="entry-date"><i class="fa-regular fa-calendar"></i> ${formatDateVietnamese(item.date)}</span>
            </div>
          </div>
        </div>
        <div class="entry-right">
          <span class="entry-amount ${isIncome ? 'positive' : 'negative'}">
            ${sign}${formatMoney(absAmount)}
          </span>
          <button class="btn-delete-entry" data-entry-id="${item.id}" title="Xóa giao dịch này" aria-label="Xóa dòng này">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;

      // Delete Entry Action
      const delBtn = el.querySelector('.btn-delete-entry');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Bạn có chắc chắn muốn xóa giao dịch ${formatMoney(item.amount)} ngày ${formatDateVietnamese(item.date)}?`)) {
          fund.entries = fund.entries.filter(e => e.id !== item.id);
          saveFundsToStorage();
          renderActiveFundDashboard();
          renderFundsNavigation();
          showToast('Đã xóa giao dịch thành công!', 'info');
        }
      });

      container.appendChild(el);
    });
  }

  function renderApp() {
    renderFundsNavigation();
    renderActiveFundDashboard();
  }

  // --- ACTIONS: ADD / EDIT / DELETE FUND ---

  function openFundModal(fundToEdit = null) {
    const modal = document.getElementById('modal-fund');
    const titleEl = document.getElementById('modal-fund-title');
    const form = document.getElementById('form-fund');
    const initialBalanceGroup = document.getElementById('initial-balance-group');

    form.reset();

    if (fundToEdit) {
      titleEl.textContent = 'Chỉnh Sửa Quỹ Mục Tiêu';
      document.getElementById('fund-edit-id').value = fundToEdit.id;
      document.getElementById('fund-name-input').value = fundToEdit.name;
      document.getElementById('fund-target-input').value = new Intl.NumberFormat('vi-VN').format(fundToEdit.target);
      document.getElementById('fund-category-select').value = fundToEdit.category || 'Mục Tiêu Cá Nhân';
      document.getElementById('fund-icon-select').value = fundToEdit.icon || '🎯';
      document.getElementById('fund-deadline-input').value = fundToEdit.deadline || '';
      document.getElementById('fund-desc-input').value = fundToEdit.description || '';
      // Hide initial balance on edit
      if (initialBalanceGroup) initialBalanceGroup.style.display = 'none';
    } else {
      titleEl.textContent = 'Tạo Quỹ Mục Tiêu Mới';
      document.getElementById('fund-edit-id').value = '';
      if (initialBalanceGroup) initialBalanceGroup.style.display = 'block';
      document.getElementById('fund-initial-balance').value = '0';
    }

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('fund-name-input').focus();
  }

  function closeFundModal() {
    const modal = document.getElementById('modal-fund');
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  function handleFundFormSubmit(e) {
    e.preventDefault();

    const editId = document.getElementById('fund-edit-id').value.trim();
    const name = document.getElementById('fund-name-input').value.trim();
    const target = parseFormattedNumber(document.getElementById('fund-target-input').value);
    const category = document.getElementById('fund-category-select').value;
    const icon = document.getElementById('fund-icon-select').value;
    const deadline = document.getElementById('fund-deadline-input').value;
    const description = document.getElementById('fund-desc-input').value.trim();

    if (!name) {
      showToast('Vui lòng nhập tên quỹ!', 'error');
      return;
    }
    if (target <= 0) {
      showToast('Vui lòng nhập số tiền mục tiêu lớn hơn 0!', 'error');
      return;
    }

    if (editId) {
      // EDIT EXISTING FUND
      const fund = funds.find(f => f.id === editId);
      if (fund) {
        fund.name = name;
        fund.target = target;
        fund.category = category;
        fund.icon = icon;
        fund.deadline = deadline || null;
        fund.description = description;

        saveFundsToStorage();
        closeFundModal();
        renderApp();
        showToast(`Đã cập nhật quỹ "${name}"!`, 'success');
      }
    } else {
      // CREATE NEW FUND
      const initialBalance = parseFormattedNumber(document.getElementById('fund-initial-balance').value);
      const newFundId = generateId();
      const entries = [];

      if (initialBalance > 0) {
        entries.push({
          id: generateId(),
          date: getTodayString(),
          amount: initialBalance,
          type: 'income',
          note: 'Số tiền có sẵn ban đầu',
          timestamp: Date.now()
        });
      }

      const newFund = {
        id: newFundId,
        name,
        target,
        category,
        icon,
        deadline: deadline || null,
        description,
        createdAt: getTodayString(),
        entries
      };

      funds.unshift(newFund);
      activeFundId = newFundId;
      saveFundsToStorage();
      closeFundModal();
      renderApp();

      playCoinSound();
      triggerConfetti(false);
      showToast(`Đã tạo thành công quỹ "${name}"!`, 'success', 'fa-solid fa-bullseye');
    }
  }

  function deleteCurrentFund() {
    const fund = getActiveFund();
    if (!fund) return;

    if (confirm(`Bạn có chắc chắn muốn xóa quỹ "${fund.name}" cùng toàn bộ lịch sử đóng góp? Thao tác này không thể hoàn tác!`)) {
      funds = funds.filter(f => f.id !== fund.id);
      activeFundId = funds.length > 0 ? funds[0].id : null;
      saveFundsToStorage();
      renderApp();
      showToast(`Đã xóa quỹ "${fund.name}"`, 'info');
    }
  }

  function clearAllFunds() {
    if (funds.length === 0) {
      showToast('Hiện không có quỹ nào để xóa!', 'info');
      return;
    }

    if (confirm('Bạn có chắc chắn muốn xóa tất cả các quỹ mục tiêu? Toàn bộ dữ liệu sẽ được xóa sạch và không thể hoàn tác!')) {
      funds = [];
      activeFundId = null;
      saveFundsToStorage();
      renderApp();
      showToast('Đã xóa tất cả các quỹ thành công!', 'info');
    }
  }

  // --- ACTIONS: DAILY DEPOSIT SUBMIT ---
  function handleDepositSubmit(e) {
    e.preventDefault();

    const fund = getActiveFund();
    if (!fund) {
      showToast('Chưa có quỹ nào được chọn!', 'error');
      return;
    }

    const amountInput = document.getElementById('deposit-amount');
    const dateInput = document.getElementById('deposit-date');
    const typeSelect = document.getElementById('deposit-type');
    const noteInput = document.getElementById('deposit-note');

    const rawAmount = parseFormattedNumber(amountInput.value);
    const dateVal = dateInput.value || getTodayString();
    const typeVal = typeSelect.value;
    const noteVal = noteInput.value.trim();

    if (rawAmount <= 0) {
      showToast('Vui lòng nhập số tiền hợp lệ!', 'error');
      amountInput.focus();
      return;
    }

    // Previous percent
    const prevTotal = (fund.entries || []).reduce((sum, item) => sum + item.amount, 0);
    const prevPct = fund.target > 0 ? (prevTotal / fund.target) * 100 : 0;

    const actualAmount = typeVal === 'withdraw' ? -rawAmount : rawAmount;

    const newEntry = {
      id: generateId(),
      date: dateVal,
      amount: actualAmount,
      type: typeVal,
      note: noteVal,
      timestamp: Date.now()
    };

    if (!fund.entries) fund.entries = [];
    fund.entries.push(newEntry);
    saveFundsToStorage();

    // New percent check for celebrations
    const newTotal = fund.entries.reduce((sum, item) => sum + item.amount, 0);
    const newPct = fund.target > 0 ? (newTotal / fund.target) * 100 : 0;

    // Reset form inputs (except date which stays today)
    amountInput.value = '';
    noteInput.value = '';

    renderActiveFundDashboard();
    renderFundsNavigation();

    if (typeVal === 'income') {
      playCoinSound();
      triggerConfetti(false);

      if (newPct >= 100 && prevPct < 100) {
        // Milestone 100% reached!
        playMilestoneSound();
        triggerConfetti(true);
        showToast(`🎉 XIN CHÚC MỪNG! Bạn đã hoàn thành 100% mục tiêu quỹ "${fund.name}"!`, 'celebrate', 'fa-solid fa-trophy');
      } else if (newPct >= 50 && prevPct < 50) {
        playMilestoneSound();
        triggerConfetti(true);
        showToast(`⚡ Chúc mừng! Bạn đã vượt qua 50% chặng đường!`, 'celebrate', 'fa-solid fa-bolt');
      } else {
        showToast(`Đã cộng +${formatMoney(rawAmount)} vào quỹ "${fund.name}"! Tiến độ: ${newPct.toFixed(1)}%`, 'success', 'fa-solid fa-circle-check');
      }
    } else {
      showToast(`Đã ghi nhận rút -${formatMoney(rawAmount)} khỏi quỹ. Tiến độ: ${newPct.toFixed(1)}%`, 'info');
    }
  }

  // --- SOUND & THEME TOGGLE ---
  function updateThemeButtonIcon() {
    const btn = document.getElementById('btn-toggle-theme');
    if (!btn) return;
    const isDark = document.body.classList.contains('theme-dark');
    btn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    btn.title = isDark ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối';
  }

  function toggleTheme() {
    if (document.body.classList.contains('theme-dark')) {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
      localStorage.setItem(STORAGE_KEY_THEME, 'theme-light');
    } else {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
      localStorage.setItem(STORAGE_KEY_THEME, 'theme-dark');
    }
    updateThemeButtonIcon();
  }

  function updateSoundButtonIcon() {
    const btn = document.getElementById('btn-toggle-sound');
    if (!btn) return;
    btn.innerHTML = soundEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
    btn.title = soundEnabled ? 'Tắt âm thanh hiệu ứng' : 'Bật âm thanh hiệu ứng';
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem(STORAGE_KEY_SOUND, soundEnabled ? 'true' : 'false');
    updateSoundButtonIcon();
    showToast(soundEnabled ? 'Đã bật âm thanh hiệu ứng' : 'Đã tắt âm thanh hiệu ứng', 'info');
    if (soundEnabled) playCoinSound();
  }

  // --- EXPORT & IMPORT DATA (JSON) ---
  function exportFundData() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(funds, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `tichtieuthanhdai_backup_${getTodayString()}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Đã tải xuống file sao lưu dữ liệu!', 'success');
  }

  function restoreFundData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          funds = imported;
          if (funds.length > 0) activeFundId = funds[0].id;
          saveFundsToStorage();
          renderApp();
          showToast(`Khôi phục thành công ${funds.length} quỹ mục tiêu!`, 'success');
        } else {
          showToast('File dữ liệu không đúng định dạng!', 'error');
        }
      } catch (err) {
        showToast('Lỗi khi đọc file JSON!', 'error');
      }
    };
    reader.readAsText(file);
  }

  // --- CLOUD SYNC ENGINE (FIREBASE REALTIME DB / SSE REALTIME STREAM) ---
  function normalizeFirebaseUrl(url) {
    if (!url) return '';
    let clean = url.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    return clean.replace(/\/+$/, '');
  }

  function generateSyncPin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  function updateSyncStatusUI(status, message = '') {
    const statusDot = document.getElementById('sync-status-dot');
    const btnLabel = document.getElementById('sync-btn-label');
    const pulseDot = document.getElementById('sync-pulse-dot');
    const statusTitle = document.getElementById('sync-status-title');
    const statusDesc = document.getElementById('sync-status-desc');
    const disconnectBtn = document.getElementById('btn-disconnect-sync');
    const syncNowBtn = document.getElementById('btn-sync-now');
    const banner = document.getElementById('sync-status-banner');
    const shareArea = document.getElementById('sync-connected-share');
    const qrImg = document.getElementById('sync-qr-image');
    const shareLink = document.getElementById('sync-share-link');

    if (!statusDot) return;

    statusDot.className = 'sync-status-dot ' + status;
    if (pulseDot) pulseDot.className = 'pulse-dot ' + status;
    if (banner) {
      if (status === 'connected') banner.classList.add('connected');
      else banner.classList.remove('connected');
    }

    if (status === 'connected') {
      if (btnLabel) btnLabel.textContent = `Đang Đồng Bộ (${syncConfig.pin})`;
      if (statusTitle) statusTitle.textContent = `🟢 Đang kết nối phòng: ${syncConfig.pin}`;
      if (statusDesc) statusDesc.textContent = message || 'Dữ liệu được cập nhật 2 chiều tự động thời gian thực.';
      if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';
      if (syncNowBtn) syncNowBtn.style.display = 'inline-flex';
      if (shareArea) shareArea.style.display = 'block';

      // Generate share link & QR code
      const currentUrl = window.location.href.split('?')[0];
      const fullShareUrl = `${currentUrl}?sync_db=${encodeURIComponent(syncConfig.dbUrl)}&sync_pin=${encodeURIComponent(syncConfig.pin)}`;
      if (shareLink) shareLink.value = fullShareUrl;
      if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(fullShareUrl)}`;
      }
    } else if (status === 'syncing') {
      if (btnLabel) btnLabel.textContent = 'Đang đồng bộ...';
      if (statusTitle) statusTitle.textContent = '⚡ Đang truyền dữ liệu...';
      if (statusDesc) statusDesc.textContent = message || 'Đang kết nối và đồng bộ với Cloud.';
    } else {
      if (btnLabel) btnLabel.textContent = 'Đồng Bộ Cloud';
      if (statusTitle) statusTitle.textContent = '⚪ Chưa kết nối Cloud';
      if (statusDesc) statusDesc.textContent = message || 'Dữ liệu hiện chỉ lưu trên trình duyệt máy này.';
      if (disconnectBtn) disconnectBtn.style.display = 'none';
      if (syncNowBtn) syncNowBtn.style.display = 'none';
      if (shareArea) shareArea.style.display = 'none';
    }
  }

  async function pushFundsToCloud() {
    if (!syncConfig.enabled || !syncConfig.dbUrl || !syncConfig.pin) return;

    try {
      updateSyncStatusUI('syncing', 'Đang tải dữ liệu lên Cloud...');
      lastLocalPushTimestamp = Date.now();
      const endpoint = `${syncConfig.dbUrl}/sync_rooms/${syncConfig.pin}.json`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funds: funds,
          activeFundId: activeFundId,
          updatedAt: lastLocalPushTimestamp
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      syncConfig.lastSyncTime = lastLocalPushTimestamp;
      localStorage.setItem(STORAGE_KEY_SYNC_CONFIG, JSON.stringify(syncConfig));
      updateSyncStatusUI('connected', `Đã đồng bộ lúc ${new Date().toLocaleTimeString('vi-VN')}`);
    } catch (err) {
      console.warn('Cloud push error:', err);
      updateSyncStatusUI('offline', 'Không thể kết nối Cloud (kiểm tra lại URL hoặc mạng)');
    }
  }

  async function fetchFundsFromCloud(silent = false) {
    if (!syncConfig.enabled || !syncConfig.dbUrl || !syncConfig.pin) return;

    try {
      updateSyncStatusUI('syncing', 'Đang kéo dữ liệu từ Cloud...');
      const endpoint = `${syncConfig.dbUrl}/sync_rooms/${syncConfig.pin}.json`;
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const remoteData = await response.json();

      if (remoteData && Array.isArray(remoteData.funds)) {
        // If cloud data exists and is valid
        if (!remoteData.updatedAt || remoteData.updatedAt >= (syncConfig.lastSyncTime || 0)) {
          funds = remoteData.funds;
          activeFundId = remoteData.activeFundId || (funds[0] ? funds[0].id : null);
          syncConfig.lastSyncTime = remoteData.updatedAt || Date.now();
          saveFundsToStorage(true); // Don't re-push to cloud
          renderApp();
          if (!silent) {
            showToast(`Đã đồng bộ ${funds.length} quỹ từ Cloud!`, 'success', 'fa-solid fa-cloud-arrow-down');
          }
        }
      } else if (!remoteData && funds.length > 0) {
        // Cloud room is empty, push local funds up
        await pushFundsToCloud();
      }

      updateSyncStatusUI('connected', `Đã đồng bộ lúc ${new Date().toLocaleTimeString('vi-VN')}`);
    } catch (err) {
      console.warn('Cloud fetch error:', err);
      updateSyncStatusUI('offline', 'Không thể tải từ Cloud (kiểm tra lại URL hoặc mạng)');
    }
  }

  function startRealtimeStream() {
    if (!syncConfig.enabled || !syncConfig.dbUrl || !syncConfig.pin) return;

    if (eventSourceInstance) {
      eventSourceInstance.close();
      eventSourceInstance = null;
    }

    try {
      const sseUrl = `${syncConfig.dbUrl}/sync_rooms/${syncConfig.pin}.json`;
      eventSourceInstance = new EventSource(sseUrl);

      eventSourceInstance.addEventListener('put', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload && payload.data) {
            const cloudObj = payload.data;
            if (cloudObj.updatedAt && cloudObj.updatedAt !== lastLocalPushTimestamp) {
              if (Array.isArray(cloudObj.funds)) {
                funds = cloudObj.funds;
                activeFundId = cloudObj.activeFundId || (funds[0] ? funds[0].id : null);
                syncConfig.lastSyncTime = cloudObj.updatedAt;
                saveFundsToStorage(true); // Don't bounce back
                renderApp();
                showToast('Đã nhận cập nhật mới từ thiết bị khác!', 'info', 'fa-solid fa-cloud-bolt');
                updateSyncStatusUI('connected', `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')}`);
              }
            }
          }
        } catch (err) {
          console.warn('SSE parse error:', err);
        }
      });

      eventSourceInstance.onerror = () => {
        // SSE will attempt auto-reconnect
      };
    } catch (e) {
      console.warn('SSE initialization failed:', e);
    }
  }

  async function connectCloudSync(rawUrl, pin) {
    const cleanUrl = normalizeFirebaseUrl(rawUrl);
    const cleanPin = pin.trim();

    if (!cleanUrl) {
      showToast('Vui lòng nhập đường dẫn Firebase Database!', 'error');
      return false;
    }
    if (!cleanPin) {
      showToast('Vui lòng nhập Mã Đồng Bộ (PIN)!', 'error');
      return false;
    }

    syncConfig = {
      enabled: true,
      dbUrl: cleanUrl,
      pin: cleanPin,
      lastSyncTime: 0
    };

    localStorage.setItem(STORAGE_KEY_SYNC_CONFIG, JSON.stringify(syncConfig));
    updateSyncStatusUI('syncing', 'Đang thiết lập kết nối...');

    // Test connection & pull/push initial data
    await fetchFundsFromCloud(false);
    startRealtimeStream();
    playCoinSound();
    triggerConfetti(false);
    showToast(`Đã kết nối thành công phòng đồng bộ: ${cleanPin}!`, 'success', 'fa-solid fa-cloud-check');
    return true;
  }

  function disconnectCloudSync() {
    if (eventSourceInstance) {
      eventSourceInstance.close();
      eventSourceInstance = null;
    }

    syncConfig = {
      enabled: false,
      dbUrl: '',
      pin: '',
      lastSyncTime: null
    };

    localStorage.removeItem(STORAGE_KEY_SYNC_CONFIG);
    updateSyncStatusUI('offline', 'Đã ngắt kết nối Cloud. Dữ liệu tiếp tục lưu cục bộ.');
    showToast('Đã ngắt kết nối Cloud', 'info');
  }

  function openSyncModal() {
    const modal = document.getElementById('modal-cloud-sync');
    const pinInput = document.getElementById('sync-pin-input');
    const urlInput = document.getElementById('sync-db-url');

    if (syncConfig.enabled) {
      if (pinInput) pinInput.value = syncConfig.pin;
      if (urlInput) urlInput.value = syncConfig.dbUrl;
      updateSyncStatusUI('connected');
    } else {
      if (pinInput && !pinInput.value) pinInput.value = generateSyncPin();
      updateSyncStatusUI('offline');
    }

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeSyncModal() {
    const modal = document.getElementById('modal-cloud-sync');
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  function initCloudSync() {
    // Check URL parameters for 1-click connect from QR code
    const params = new URLSearchParams(window.location.search);
    const paramDb = params.get('sync_db');
    const paramPin = params.get('sync_pin');

    if (paramDb && paramPin) {
      connectCloudSync(paramDb, paramPin).then(() => {
        // Clean URL params
        window.history.replaceState({}, document.title, window.location.pathname);
      });
      return;
    }

    // Load saved sync config
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SYNC_CONFIG);
      if (saved) {
        syncConfig = JSON.parse(saved);
        if (syncConfig.enabled && syncConfig.dbUrl && syncConfig.pin) {
          updateSyncStatusUI('connected');
          fetchFundsFromCloud(true);
          startRealtimeStream();
        }
      }
    } catch (e) {
      console.error('Failed to load sync config', e);
    }
  }

  // --- INITIALIZE EVENT LISTENERS ---
  function initEvents() {
    // Default today date for deposit
    const depositDateInput = document.getElementById('deposit-date');
    if (depositDateInput) {
      depositDateInput.value = getTodayString();
    }

    // Amount input formatting
    const depositAmountInput = document.getElementById('deposit-amount');
    if (depositAmountInput) {
      depositAmountInput.addEventListener('input', () => formatInputCurrency(depositAmountInput));
    }

    const fundTargetInput = document.getElementById('fund-target-input');
    if (fundTargetInput) {
      fundTargetInput.addEventListener('input', () => formatInputCurrency(fundTargetInput));
    }

    const fundInitialInput = document.getElementById('fund-initial-balance');
    if (fundInitialInput) {
      fundInitialInput.addEventListener('input', () => formatInputCurrency(fundInitialInput));
    }

    // Quick chip buttons for daily earnings
    const chips = document.querySelectorAll('.quick-amounts-bar .chip-btn');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const addVal = parseInt(chip.dataset.val, 10) || 0;
        const currentVal = parseFormattedNumber(depositAmountInput.value);
        const nextVal = currentVal + addVal;
        depositAmountInput.value = new Intl.NumberFormat('vi-VN').format(nextVal);
        playCoinSound();
      });
    });

    // Quick chip presets for target in modal
    const targetChips = document.querySelectorAll('.quick-target-bar .chip-btn');
    targetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const val = parseInt(chip.dataset.targetPreset, 10) || 0;
        fundTargetInput.value = new Intl.NumberFormat('vi-VN').format(val);
      });
    });

    // Deposit form submit
    const depositForm = document.getElementById('form-add-deposit');
    if (depositForm) {
      depositForm.addEventListener('submit', handleDepositSubmit);
    }

    // Fund modal form submit
    const fundForm = document.getElementById('form-fund');
    if (fundForm) {
      fundForm.addEventListener('submit', handleFundFormSubmit);
    }

    // Open/Close fund modal
    document.getElementById('btn-open-create-fund')?.addEventListener('click', () => openFundModal());
    document.getElementById('btn-create-first-fund')?.addEventListener('click', () => openFundModal());
    document.getElementById('btn-close-fund-modal')?.addEventListener('click', closeFundModal);
    document.getElementById('btn-cancel-fund')?.addEventListener('click', closeFundModal);

    // Close fund modal when clicking backdrop
    const modalBackdrop = document.getElementById('modal-fund');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeFundModal();
      });
    }

    // Open/Close Cloud Sync modal
    document.getElementById('btn-open-cloud-sync')?.addEventListener('click', openSyncModal);
    document.getElementById('btn-footer-sync')?.addEventListener('click', openSyncModal);
    document.getElementById('btn-close-sync-modal')?.addEventListener('click', closeSyncModal);
    document.getElementById('btn-cancel-sync')?.addEventListener('click', closeSyncModal);

    // Close sync modal when clicking backdrop
    const syncModalBackdrop = document.getElementById('modal-cloud-sync');
    if (syncModalBackdrop) {
      syncModalBackdrop.addEventListener('click', (e) => {
        if (e.target === syncModalBackdrop) closeSyncModal();
      });
    }

    // Generate random PIN
    document.getElementById('btn-generate-pin')?.addEventListener('click', () => {
      const pinInput = document.getElementById('sync-pin-input');
      if (pinInput) pinInput.value = generateSyncPin();
    });

    // Form cloud sync submit
    document.getElementById('form-cloud-sync')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = document.getElementById('sync-db-url').value;
      const pin = document.getElementById('sync-pin-input').value;
      await connectCloudSync(url, pin);
    });

    // Disconnect sync button
    document.getElementById('btn-disconnect-sync')?.addEventListener('click', () => {
      if (confirm('Bạn có chắc muốn ngắt kết nối Cloud? Dữ liệu trên trình duyệt này vẫn được giữ nguyên.')) {
        disconnectCloudSync();
      }
    });

    // Sync now manual button
    document.getElementById('btn-sync-now')?.addEventListener('click', () => {
      fetchFundsFromCloud(false);
    });

    // Copy share link button
    document.getElementById('btn-copy-sync-link')?.addEventListener('click', () => {
      const linkInput = document.getElementById('sync-share-link');
      if (linkInput && linkInput.value) {
        navigator.clipboard.writeText(linkInput.value).then(() => {
          showToast('Đã copy link đồng bộ vào clipboard!', 'success');
        }).catch(() => {
          linkInput.select();
          document.execCommand('copy');
          showToast('Đã copy link đồng bộ!', 'success');
        });
      }
    });

    // Fund Options Dropdown Menu
    const fundMenuBtn = document.getElementById('btn-fund-menu');
    const fundDropdown = document.getElementById('fund-dropdown-menu');
    if (fundMenuBtn && fundDropdown) {
      fundMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fundDropdown.classList.toggle('show');
      });

      document.addEventListener('click', () => {
        fundDropdown.classList.remove('show');
      });
    }

    document.getElementById('btn-edit-current-fund')?.addEventListener('click', () => {
      const fund = getActiveFund();
      if (fund) openFundModal(fund);
    });

    document.getElementById('btn-delete-current-fund')?.addEventListener('click', deleteCurrentFund);
    document.getElementById('btn-export-current-fund')?.addEventListener('click', exportFundData);

    // Search / Filter entries
    const filterInput = document.getElementById('filter-history-input');
    if (filterInput) {
      filterInput.addEventListener('input', () => {
        const fund = getActiveFund();
        if (fund) renderEntriesList(fund);
      });
    }

    // Theme & Sound toggles
    document.getElementById('btn-toggle-theme')?.addEventListener('click', toggleTheme);
    document.getElementById('btn-toggle-sound')?.addEventListener('click', toggleSound);

    // Backup & Restore
    document.getElementById('btn-backup-data')?.addEventListener('click', exportFundData);
    const restoreFileInput = document.getElementById('file-restore-input');
    document.getElementById('btn-restore-data')?.addEventListener('click', () => {
      restoreFileInput?.click();
    });
    restoreFileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        restoreFundData(e.target.files[0]);
      }
    });

    // Clear all funds button
    document.getElementById('btn-clear-all-funds')?.addEventListener('click', clearAllFunds);

    // Keyboard shortcuts: Escape closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeFundModal();
        closeSyncModal();
      }
    });
  }

  // --- INITIALIZATION ---
  function init() {
    loadFundsFromStorage();
    initEvents();
    renderApp();
    initCloudSync();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
