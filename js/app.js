/**
 * TÍCH TIỂU THÀNH ĐẠI - LOGIC QUẢN LÝ QUỸ MỤC TIÊU TIỀN HÀNG NGÀY
 */

(function () {
  'use strict';

  // --- STORAGE KEYS ---
  const STORAGE_KEY_FUNDS = 'tttd_funds_data_v1';
  const STORAGE_KEY_ACTIVE = 'tttd_active_fund_id';
  const STORAGE_KEY_THEME = 'tttd_user_theme';
  const STORAGE_KEY_SOUND = 'tttd_sound_setting';

  // --- CIRCUMFERENCE CONSTANT FOR 82px RADIUS SVG CIRCLE ---
  const CIRCLE_RADIUS = 82;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS; // ~515.221

  // --- STATE ---
  let funds = [];
  let activeFundId = null;
  let soundEnabled = true;

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

  // --- SEED SAMPLE DATA (When fresh start) ---
  function createSampleData() {
    const today = new Date();
    const formatD = (daysAgo) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const sampleFund1 = {
      id: generateId(),
      name: 'Quỹ Đổi iPhone 16 Pro Max',
      target: 34000000,
      category: 'Đồ Công Nghệ',
      icon: '📱',
      deadline: `${today.getFullYear()}-12-31`,
      description: 'Cày thêm dự án và tiết kiệm mỗi ngày để tự thưởng bản thân!',
      createdAt: formatD(7),
      entries: [
        {
          id: generateId(),
          date: formatD(6),
          amount: 5000000,
          type: 'income',
          note: 'Số tiền tiết kiệm ban đầu',
          timestamp: Date.now() - 6 * 86400000
        },
        {
          id: generateId(),
          date: formatD(4),
          amount: 800000,
          type: 'income',
          note: 'Làm thêm ca ngoài giờ',
          timestamp: Date.now() - 4 * 86400000
        },
        {
          id: generateId(),
          date: formatD(3),
          amount: 1200000,
          type: 'income',
          note: 'Bán đồ cũ không dùng',
          timestamp: Date.now() - 3 * 86400000
        },
        {
          id: generateId(),
          date: formatD(2),
          amount: 500000,
          type: 'income',
          note: 'Tiền thưởng tuần',
          timestamp: Date.now() - 2 * 86400000
        },
        {
          id: generateId(),
          date: formatD(1),
          amount: 650000,
          type: 'income',
          note: 'Tiết kiệm chi tiêu trong ngày',
          timestamp: Date.now() - 1 * 86400000
        },
        {
          id: generateId(),
          date: formatD(0),
          amount: 850000,
          type: 'income',
          note: 'Thu nhập kiếm được hôm nay',
          timestamp: Date.now()
        }
      ]
    };

    const sampleFund2 = {
      id: generateId(),
      name: 'Quỹ Du Lịch Đà Lạt 4N3Đ',
      target: 7500000,
      category: 'Du Lịch',
      icon: '✈️',
      deadline: `${today.getFullYear()}-09-15`,
      description: 'Chuyến vi vu cùng bạn bè khám phá đồi thông và săn mây.',
      createdAt: formatD(10),
      entries: [
        {
          id: generateId(),
          date: formatD(5),
          amount: 2000000,
          type: 'income',
          note: 'Trích từ tiền lương',
          timestamp: Date.now() - 5 * 86400000
        },
        {
          id: generateId(),
          date: formatD(2),
          amount: 1500000,
          type: 'income',
          note: 'Tiền thưởng dự án',
          timestamp: Date.now() - 2 * 86400000
        }
      ]
    };

    return [sampleFund1, sampleFund2];
  }

  // --- LOCAL STORAGE HANDLING ---
  function loadFundsFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_FUNDS);
      if (data) {
        funds = JSON.parse(data);
      } else {
        funds = createSampleData();
        saveFundsToStorage();
      }
    } catch (e) {
      console.error('Failed to load funds from storage', e);
      funds = createSampleData();
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

  function saveFundsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_FUNDS, JSON.stringify(funds));
      if (activeFundId) {
        localStorage.setItem(STORAGE_KEY_ACTIVE, activeFundId);
      }
    } catch (e) {
      console.error('Failed to save to localStorage', e);
      showToast('Bộ nhớ trình duyệt đầy, không thể lưu dữ liệu!', 'error');
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
      paceEstimateEl.textContent = 'Duy trì phong độ rất tốt!';
    } else if (percent > 0) {
      statusBadgeEl.textContent = 'Đang Tích Luỹ 📈';
      statusBadgeEl.style.color = 'var(--text-muted)';
      milestoneHintEl.textContent = `Đã tích luỹ ${formattedPercent}% mục tiêu`;
      paceEstimateEl.textContent = 'Tích tiểu thành đại mỗi ngày!';
    } else {
      statusBadgeEl.textContent = 'Bắt Đầu 🌱';
      statusBadgeEl.style.color = 'var(--text-dim)';
      milestoneHintEl.textContent = 'Hãy ghi nhận khoản tiền kiếm được đầu tiên!';
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
      streakDescEl.textContent = 'Phong độ rất tốt! Hãy tiếp tục duy trì sang tuần mới nhé!';
    } else if (streakDays > 0) {
      streakDescEl.textContent = 'Khởi đầu tuyệt vời! Đừng để gián đoạn ngày mai nha!';
    } else {
      streakDescEl.textContent = 'Chưa có ghi nhận hôm nay hoặc hôm qua. Nạp ngay để bắt đầu chuỗi nhé!';
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
    const entries = (fund.entries || []).filter(e => e.type === 'income' && e.amount > 0);

    const statAvgEl = document.getElementById('stat-avg-daily');
    const statDaysEl = document.getElementById('stat-days-needed');
    const statMaxEl = document.getElementById('stat-max-entry');
    const statEtaEl = document.getElementById('stat-eta-date');

    if (entries.length === 0) {
      statAvgEl.textContent = '0 ₫';
      statDaysEl.textContent = '-- ngày';
      statMaxEl.textContent = '0 ₫';
      statEtaEl.textContent = '--/--/----';
      return;
    }

    // Unique days
    const uniqueDays = new Set(entries.map(e => e.date)).size;
    const avgDaily = uniqueDays > 0 ? totalAccumulated / uniqueDays : 0;
    statAvgEl.textContent = formatMoney(avgDaily);

    // Max entry
    const maxEntry = Math.max(...entries.map(e => e.amount));
    statMaxEl.textContent = formatMoney(maxEntry);

    // Days needed
    if (remainingMoney <= 0) {
      statDaysEl.textContent = 'Đã hoàn thành!';
      statEtaEl.textContent = 'Mục tiêu hoàn tất 🎊';
      return;
    }

    if (avgDaily > 0) {
      const daysNeeded = Math.ceil(remainingMoney / avgDaily);
      statDaysEl.textContent = `Khoảng ${daysNeeded} ngày`;

      const etaDate = new Date();
      etaDate.setDate(etaDate.getDate() + daysNeeded);
      const y = etaDate.getFullYear();
      const m = String(etaDate.getMonth() + 1).padStart(2, '0');
      const d = String(etaDate.getDate()).padStart(2, '0');
      statEtaEl.textContent = `${d}/${m}/${y}`;
    } else {
      statDaysEl.textContent = '-- ngày';
      statEtaEl.textContent = '--/--/----';
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

    // Preset buttons on empty state
    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name;
        const target = parseInt(btn.dataset.target, 10);
        const icon = btn.dataset.icon;
        const cat = btn.dataset.cat;

        const newFundId = generateId();
        const newFund = {
          id: newFundId,
          name,
          target,
          category: cat,
          icon,
          deadline: null,
          description: `Mục tiêu khởi tạo từ mẫu ${name}`,
          createdAt: getTodayString(),
          entries: []
        };

        funds.push(newFund);
        activeFundId = newFundId;
        saveFundsToStorage();
        renderApp();
        showToast(`Đã tạo quỹ mẫu "${name}"!`, 'success');
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

    // Open/Close modal
    document.getElementById('btn-open-create-fund')?.addEventListener('click', () => openFundModal());
    document.getElementById('btn-create-first-fund')?.addEventListener('click', () => openFundModal());
    document.getElementById('btn-close-fund-modal')?.addEventListener('click', closeFundModal);
    document.getElementById('btn-cancel-fund')?.addEventListener('click', closeFundModal);

    // Close modal when clicking backdrop
    const modalBackdrop = document.getElementById('modal-fund');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeFundModal();
      });
    }

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

    // Load sample data button
    document.getElementById('btn-load-sample-data')?.addEventListener('click', () => {
      if (confirm('Bạn có muốn đặt lại dữ liệu mẫu? Dữ liệu hiện tại sẽ được thay thế bằng các quỹ mẫu sinh động.')) {
        funds = createSampleData();
        activeFundId = funds[0].id;
        saveFundsToStorage();
        renderApp();
        showToast('Đã nạp thành công dữ liệu mẫu!', 'success');
      }
    });

    // Keyboard shortcuts: Escape closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeFundModal();
      }
    });
  }

  // --- INITIALIZATION ---
  function init() {
    loadFundsFromStorage();
    initEvents();
    renderApp();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
