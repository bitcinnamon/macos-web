// iCal — month view calendar with events in localStorage
(() => {
  const { el } = System;
  const KEY = 'macweb.ical.v1';

  const icon = `<svg viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="50" rx="6" fill="#fff" stroke="#8a8a8a" stroke-width="1.5"/><path d="M8 14 q0-6 6-6 h36 q6 0 6 6 v10 H8z" fill="#f04a3a"/><text x="32" y="20" text-anchor="middle" font-family="'Lucida Grande', sans-serif" font-size="10" fill="#fff" font-weight="bold">7月</text><text x="32" y="48" text-anchor="middle" font-family="'Lucida Grande', sans-serif" font-size="22" fill="#333" font-weight="bold">27</text></svg>`;

  const DEFAULT_CALENDARS = [
    { id:'home', name:'个人', color:'#4e8fd4', visible:true, builtIn:true },
    { id:'work', name:'工作', color:'#df5b51', visible:true, builtIn:true },
  ];
  function load() {
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
    if (raw.events && Array.isArray(raw.calendars)) {
      raw.calendars = raw.calendars.length ? raw.calendars : DEFAULT_CALENDARS.map((item) => ({ ...item }));
      return raw;
    }
    const events = {};
    Object.entries(raw).forEach(([date, entries]) => {
      if (!Array.isArray(entries)) return;
      events[date] = entries.map((entry) => typeof entry === 'string'
        ? { id:Date.now() + Math.random(), title:entry, time:'', calendarId:'home' }
        : entry);
    });
    return { version:2, calendars:DEFAULT_CALENDARS.map((item) => ({ ...item })), events };
  }
  function save(state) { localStorage.setItem(KEY, JSON.stringify(state)); }

  function open() {
    let state = load();
    let preferences = System.getAppPreferences?.('ical') || {};
    const now = new Date();
    let year = now.getFullYear(), month = now.getMonth();
    let selectedDate = keyOf(now);
    let selectedCalendar = state.calendars[0]?.id || 'home';
    let win = null;

    const shell = el('div', 'ical-leopard');
    const sidebar = el('aside', 'ical-calendars');
    const wrap = el('div', 'ical');
    const head = el('div', 'ical-head');
    const title = el('div', 'ical-title');
    const nav = el('div', 'ical-nav');
    const prev = el('button', 'finder-toolbar-btn', '◀');
    const today = el('button', 'finder-toolbar-btn', '今天');
    const next = el('button', 'finder-toolbar-btn', '▶');
    nav.append(prev, today, next);
    head.append(title, nav);
    const grid = el('div', 'ical-grid');
    wrap.append(head, grid);
    shell.append(sidebar, wrap);

    function addEvent(k) {
      const form = el('div', 'ical-event-sheet');
      const nameLabel = el('label');
      nameLabel.append(el('span', '', '事件：'));
      const nameInput = el('input', 'aqua-input');
      nameInput.placeholder = '新事件';
      nameLabel.appendChild(nameInput);
      const timeLabel = el('label');
      timeLabel.append(el('span', '', '时间：'));
      const timeInput = el('input', 'aqua-input');
      timeInput.type = 'time';
      timeInput.value = `${String(Number(preferences.dayStarts) || 8).padStart(2, '0')}:00`;
      timeLabel.appendChild(timeInput);
      const calendarLabel = el('label');
      calendarLabel.append(el('span', '', '日历：'));
      const calendarSelect = el('select', 'aqua-select');
      state.calendars.forEach((calendar) => {
        const option = el('option', '', calendar.name);
        option.value = calendar.id;
        option.selected = calendar.id === selectedCalendar;
        calendarSelect.appendChild(option);
      });
      calendarLabel.appendChild(calendarSelect);
      const hint = el('p', '', `${k} · ${preferences.timeZoneSupport === false ? '本地时间' : Intl.DateTimeFormat().resolvedOptions().timeZone}`);
      form.append(nameLabel, timeLabel, calendarLabel, hint);
      System.showSheet({
        parent:win, title:'新建事件', content:form, initialFocus:nameInput,
        buttons:[
          { label:'取消', cancel:true },
          { label:'添加', default:true, action:() => {
            const title = nameInput.value.trim();
            if (!title) {
              nameInput.classList.add('invalid');
              nameInput.focus();
              return false;
            }
            selectedCalendar = calendarSelect.value;
            (state.events[k] = state.events[k] || []).push({
              id:Date.now(), title, time:timeInput.value, calendarId:selectedCalendar,
            });
            save(state); render();
            return true;
          }},
        ],
      });
    }

    const startDay = () => preferences.weekStarts === 'saturday' ? 6 : preferences.weekStarts === 'sunday' ? 0 : 1;
    const dayLabels = () => {
      const labels = ['日','一','二','三','四','五','六'];
      const start = startDay();
      return Array.from({ length:7 }, (_, index) => labels[(start + index) % 7]);
    };
    const weekNumber = (date) => {
      const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const day = copy.getUTCDay() || 7;
      copy.setUTCDate(copy.getUTCDate() + 4 - day);
      const first = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
      return Math.ceil((((copy - first) / 86400000) + 1) / 7);
    };
    const calendarFor = (id) => state.calendars.find((calendar) => calendar.id === id) || state.calendars[0];
    const birthdaysFor = (date) => {
      if (preferences.showBirthdays === false) return [];
      let contacts = [];
      try { contacts = JSON.parse(localStorage.getItem('macweb.addressbook.v1') || '[]'); } catch (e) {}
      const monthDay = `${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      return contacts.filter((contact) => String(contact.birthday || '').slice(-5) === monthDay)
        .map((contact) => ({ title:`🎂 ${contact.last || ''}${contact.first || ''}`, birthday:true }));
    };
    const renderCalendars = () => {
      sidebar.innerHTML = '<h4>日历</h4><div class="ical-calendar-list"></div><footer><button class="aqua-btn ical-add-calendar" title="新建日历">＋</button><button class="aqua-btn ical-remove-calendar" title="删除日历">－</button></footer>';
      const list = sidebar.querySelector('.ical-calendar-list');
      state.calendars.forEach((calendar) => {
        const row = el('label', calendar.id === selectedCalendar ? 'sel' : '');
        row.dataset.calendarId = calendar.id;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = calendar.visible !== false;
        const dot = el('i');
        dot.style.background = calendar.color;
        row.append(checkbox, dot, document.createTextNode(calendar.name));
        checkbox.addEventListener('change', () => {
          calendar.visible = checkbox.checked;
          save(state); render();
        });
        row.addEventListener('click', () => {
          selectedCalendar = calendar.id;
          renderCalendars();
        });
        list.appendChild(row);
      });
      sidebar.querySelector('.ical-add-calendar').addEventListener('click', createCalendar);
      sidebar.querySelector('.ical-remove-calendar').addEventListener('click', removeCalendar);
    };
    function render() {
      title.textContent = `${year} 年 ${month + 1} 月`;
      grid.innerHTML = '';
      grid.classList.toggle('show-week-numbers', !!preferences.showWeekNumbers);
      if (preferences.showWeekNumbers) grid.appendChild(el('div', 'ical-dow ical-week-head', '周'));
      dayLabels().forEach((d) => grid.appendChild(el('div', 'ical-dow', d)));
      const first = new Date(year, month, 1);
      const offset = (first.getDay() - startDay() + 7) % 7;
      const start = new Date(year, month, 1 - offset);
      const todayStr = keyOf(new Date());
      for (let week = 0; week < 6; week++) {
        if (preferences.showWeekNumbers) {
          const weekDate = new Date(start);
          weekDate.setDate(start.getDate() + week * 7 + 3);
          grid.appendChild(el('div', 'ical-week-number', String(weekNumber(weekDate))));
        }
        for (let day = 0; day < 7; day++) {
          const index = week * 7 + day;
          const d = new Date(start);
          d.setDate(start.getDate() + index);
          const k = keyOf(d);
          const cell = el('div', 'ical-cell' + (d.getMonth() !== month ? ' other' : '') + (k === todayStr ? ' today' : '') + (k === selectedDate ? ' selected' : ''));
          cell.innerHTML = `<span class="ic-num">${d.getDate()}</span>`;
          const entries = [
            ...(state.events[k] || []).filter((event) => calendarFor(event.calendarId)?.visible !== false),
            ...birthdaysFor(d),
          ];
          entries.forEach((event) => {
            const evEl = el('button', `ical-ev${event.birthday ? ' birthday' : ''}`);
            evEl.textContent = `${event.time ? `${event.time} ` : ''}${event.title}`;
            const calendar = calendarFor(event.calendarId);
            if (!event.birthday && calendar?.color) evEl.style.setProperty('--ical-event-color', calendar.color);
            evEl.title = event.birthday ? '通讯录生日' : '双击删除';
            if (!event.birthday) evEl.addEventListener('dblclick', (e) => {
              e.stopPropagation();
              System.confirmSheet({
                parent:win, headline:`删除事件“${event.title}”？`, message:`${k}${event.time ? ` ${event.time}` : ''}`,
                okLabel:'删除', danger:true, onOK:() => {
                  state.events[k] = (state.events[k] || []).filter((item) => item.id !== event.id);
                  if (!state.events[k].length) delete state.events[k];
                  save(state); render();
                },
              });
            });
            cell.appendChild(evEl);
          });
          cell.addEventListener('click', () => { selectedDate = k; render(); });
          cell.addEventListener('dblclick', (event) => {
            if (event.target.closest('.ical-ev')) return;
            selectedDate = k; addEvent(k);
          });
          grid.appendChild(cell);
        }
      }
      renderCalendars();
      if (win?._status) {
        const count = Object.values(state.events).reduce((sum, entries) => sum + entries.length, 0);
        const zone = preferences.timeZoneSupport === false ? '本地时间' : Intl.DateTimeFormat().resolvedOptions().timeZone;
        win._status.textContent = `${count} 个事件 · ${zone} · 双击日期添加`;
      }
    }
    function keyOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
    function createCalendar() {
      System.promptSheet({
        parent:win,title:'新建日历',message:'日历名称：',value:'未命名日历',okLabel:'创建',
        validate:name=>state.calendars.some((calendar)=>calendar.name.toLowerCase()===name.toLowerCase())?'已经存在同名日历。':true,
        onOK:name=>{
          const palette=['#7d62b3','#e18c3b','#3ca66a','#cc5b91'];
          const calendar={id:`calendar-${Date.now()}`,name,color:palette[state.calendars.length%palette.length],visible:true};
          state.calendars.push(calendar);selectedCalendar=calendar.id;save(state);render();
        },
      });
    }
    function removeCalendar() {
      const calendar=calendarFor(selectedCalendar);
      if (!calendar || calendar.builtIn) {
        Leopard.toast('iCal','内建日历不能删除。');
        return;
      }
      System.confirmSheet({
        parent:win,headline:`删除日历“${calendar.name}”？`,message:'其中的事件会移到“个人”日历。',
        okLabel:'删除',danger:true,onOK:()=>{
          Object.values(state.events).forEach((entries)=>entries.forEach((event)=>{if(event.calendarId===calendar.id)event.calendarId='home';}));
          state.calendars=state.calendars.filter((item)=>item.id!==calendar.id);
          selectedCalendar='home';save(state);render();
        },
      });
    }
    function showEventInfo() {
      const entries=(state.events[selectedDate]||[]).filter((event)=>calendarFor(event.calendarId)?.visible!==false);
      const pane=el('div','ical-event-info');
      pane.innerHTML=`<header><b>${selectedDate}</b><span>${entries.length} 个事件</span></header><main>${entries.map((event)=>`<article><i style="background:${calendarFor(event.calendarId)?.color||'#4e8fd4'}"></i><div><b>${event.time?`${event.time} `:''}${event.title}</b><small>${calendarFor(event.calendarId)?.name||'个人'}</small></div></article>`).join('')||'<p>这一天没有事件。</p>'}</main>`;
      System.createWindow({
        app:'ical', title:'事件简介', width:360, height:300, content:pane,
        noResize:true, bodyBg:'#ececec',
        autoFitContent:{ minHeight:250, maxHeight:480 },
      });
    }

    prev.addEventListener('click', () => { month--; if (month < 0) { month = 11; year--; } render(); });
    next.addEventListener('click', () => { month++; if (month > 11) { month = 0; year++; } render(); });
    today.addEventListener('click', () => { const date=new Date();year=date.getFullYear();month=date.getMonth();selectedDate=keyOf(date);render(); });

    const preferencesChanged=(event)=>{
      if(event.detail?.appId!=='ical')return;
      preferences=event.detail.preferences||System.getAppPreferences?.('ical')||{};
      render();
    };
    document.addEventListener('app-preferences-changed',preferencesChanged);
    win = System.createWindow({ app: 'ical', title: 'iCal', width: 780, height: 530, content: shell, statusbar: '正在载入日历…', onClose:()=>{
      document.removeEventListener('app-preferences-changed',preferencesChanged);
      return true;
    }});
    win.addEventListener('leopard-command', (event) => {
      const command = event.detail?.command;
      if (command === 'new-event') { event.preventDefault(); addEvent(selectedDate); }
      else if (command === 'today') {
        event.preventDefault();
        const date=new Date();year=date.getFullYear();month=date.getMonth();selectedDate=keyOf(date);render();
      } else if (command === 'refresh' || command === 'month-view') {
        event.preventDefault(); state = load(); render();
      } else if (command === 'new-calendar') {
        event.preventDefault();createCalendar();
      } else if(command==='event-info'){event.preventDefault();showEventInfo();}
    });
    render();
  }

  System.registerApp({
    id: 'ical', name: 'iCal', icon, open,
    about: '月视图日历。双击格子添加日程，双击日程删除，数据本地保存。',
    keywords: 'ical calendar 日历 日程',
  });
})();

// Leopard iCal 3 — day/week/month views, event inspectors, to-dos and .ics files.
// This registration intentionally supersedes the compact month-only version
// above while preserving its persisted data format.
(() => {
  const { el } = System;
  const STORE_KEY = 'macweb.ical.v1';
  const MAIL_KEY = 'macweb.mail.v1';
  const HOUR_HEIGHT = 46;
  const iCalIcon = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="ical3-paper" x2="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#e8e8e8"/></linearGradient><linearGradient id="ical3-red" x2="0" y2="1"><stop stop-color="#ff7165"/><stop offset="1" stop-color="#c52a24"/></linearGradient><filter id="ical3-shadow"><feDropShadow dy="2" stdDeviation="1.3" flood-opacity=".4"/></filter></defs><g filter="url(#ical3-shadow)"><rect x="7" y="6" width="50" height="52" rx="6" fill="url(#ical3-paper)" stroke="#777"/><path d="M7 13q0-7 7-7h36q7 0 7 7v11H7z" fill="url(#ical3-red)" stroke="#a91f1a"/><path d="M8 24h48" stroke="#aaa"/><text x="32" y="19" text-anchor="middle" font-family="Lucida Grande,sans-serif" font-size="10" font-weight="bold" fill="#fff">7月</text><text x="32" y="49" text-anchor="middle" font-family="Helvetica Neue,sans-serif" font-size="25" font-weight="bold" fill="#333">27</text><path d="M13 10h38" stroke="#fff" stroke-opacity=".45"/></g></svg>`;
  const DEFAULT_CALENDARS = [
    { id:'home', name:'个人', color:'#4f8fd4', visible:true, builtIn:true, account:'onmy' },
    { id:'work', name:'工作', color:'#d75b50', visible:true, builtIn:true, account:'onmy' },
  ];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[character]));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const pad = (value) => String(value).padStart(2,'0');
  const keyOf = (date) => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  const dateOf = (key) => {
    const [year,month,day] = String(key || '').split('-').map(Number);
    const date = new Date(year || 1970, Math.max(0,(month || 1)-1), day || 1, 12);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  };
  const addDays = (date, amount) => {
    const next = new Date(date);
    next.setDate(next.getDate()+amount);
    return next;
  };
  const dayDiff = (left, right) => Math.round((dateOf(left)-dateOf(right))/86400000);
  const timeMinutes = (value) => {
    const [hour,minute] = String(value || '00:00').split(':').map(Number);
    return Math.max(0,Math.min(1439,(hour || 0)*60+(minute || 0)));
  };
  const timeOf = (minutes) => `${pad(Math.floor(minutes/60)%24)}:${pad(Math.round(minutes)%60)}`;
  const eventId = () => {
    try { return crypto.randomUUID(); }
    catch (error) { return `ical-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
  };
  const normalizeEvent = (event, dateKey) => {
    const start = String(event?.start || event?.time || '09:00').slice(0,5);
    const endMinutes = Math.min(1439,timeMinutes(start)+Math.max(15,Number(event?.durationMinutes)||60));
    return {
      id:String(event?.id || eventId()),
      title:String(event?.title || '新事件'),
      date:String(event?.date || dateKey),
      endDate:String(event?.endDate || event?.date || dateKey),
      start,
      end:String(event?.end || timeOf(endMinutes)).slice(0,5),
      allDay:!!event?.allDay,
      calendarId:String(event?.calendarId || 'home'),
      location:String(event?.location || ''),
      notes:String(event?.notes || ''),
      repeat:['none','daily','weekly','monthly','yearly'].includes(event?.repeat) ? event.repeat : 'none',
      alarm:['none','at-time','5m','15m','1h','1d'].includes(event?.alarm) ? event.alarm : '15m',
      attendees:Array.isArray(event?.attendees) ? event.attendees.map(String) : String(event?.attendees || '').split(/[,;\n]/).map(item=>item.trim()).filter(Boolean),
      attachments:Array.isArray(event?.attachments) ? event.attachments.map(String).filter(path=>VFS.get(path)?.type==='file') : [],
      url:String(event?.url || ''),
      createdAt:Number(event?.createdAt)||Date.now(),
      modifiedAt:Number(event?.modifiedAt)||Date.now(),
    };
  };
  const defaultTodos = () => [
    { id:eventId(), title:'检查 Leopard 完成度', due:keyOf(new Date()), calendarId:'work', done:false, priority:'medium', notes:'' },
  ];
  function readMailTodos() {
    try {
      const data=JSON.parse(localStorage.getItem(MAIL_KEY)||'null');
      if(!Array.isArray(data?.todos))return [];
      return data.todos.map(item=>({
        id:String(item.id||eventId()), title:String(item.title||'待办事项'), due:String(item.due||''),
        calendarId:String(item.calendarId||'home'), done:!!item.done,
        priority:['high','medium','low','none'].includes(item.priority)?item.priority:'none',
        notes:String(item.notes||''),
      }));
    } catch(error){ return []; }
  }
  function loadState() {
    let raw={};
    try { raw=JSON.parse(localStorage.getItem(STORE_KEY)||'{}')||{}; } catch(error){}
    const calendars=Array.isArray(raw.calendars)&&raw.calendars.length
      ? raw.calendars.map((calendar,index)=>({
        id:String(calendar.id||`calendar-${index}`),name:String(calendar.name||`日历 ${index+1}`),
        color:String(calendar.color||'#4f8fd4'),visible:calendar.visible!==false,
        builtIn:!!calendar.builtIn,account:String(calendar.account||'onmy'),
        subscribed:!!calendar.subscribed,readOnly:!!calendar.readOnly,url:String(calendar.url||''),
      }))
      : clone(DEFAULT_CALENDARS);
    const events={};
    const sourceEvents=raw.events&&typeof raw.events==='object' ? raw.events : raw;
    Object.entries(sourceEvents||{}).forEach(([date,items])=>{
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(items))return;
      events[date]=items.map(item=>normalizeEvent(typeof item==='string'?{title:item}:item,date));
    });
    const mailTodos=readMailTodos();
    const todos=Array.isArray(raw.todos)
      ? raw.todos.map(item=>({
        id:String(item.id||eventId()),title:String(item.title||'待办事项'),due:String(item.due||''),
        calendarId:String(item.calendarId||'home'),done:!!item.done,
        priority:['high','medium','low','none'].includes(item.priority)?item.priority:'none',
        notes:String(item.notes||''),
      }))
      : mailTodos.length?mailTodos:defaultTodos();
    return {
      version:3,calendars,events,todos,
      lastView:['day','week','month'].includes(raw.lastView)?raw.lastView:'month',
      selectedDate:/^\d{4}-\d{2}-\d{2}$/.test(raw.selectedDate||'')?raw.selectedDate:keyOf(new Date()),
      todoVisible:raw.todoVisible!==false,
    };
  }

  function openICal3() {
    let state=loadState();
    let preferences=System.getAppPreferences?.('ical')||{};
    let view=state.lastView;
    let selectedDate=state.selectedDate;
    let selectedCalendar=state.calendars[0]?.id||'home';
    let selectedEventId='';
    let selectedOccurrence=selectedDate;
    let query='';
    let todoVisible=state.todoVisible!==false;
    let popover=null;
    let win=null;
    let searchTimer=null;

    const toolbar=el('div','ical3-toolbar');
    const nav=el('div','ical3-nav');
    const previous=el('button','finder-toolbar-btn','◀');
    previous.title='上一个';
    const today=el('button','finder-toolbar-btn','今天');
    const next=el('button','finder-toolbar-btn','▶');
    next.title='下一个';
    nav.append(previous,today,next);
    const viewButtons=el('div','ical3-view-switch');
    [['day','日'],['week','周'],['month','月']].forEach(([id,label])=>{
      const button=el('button','',label);button.dataset.view=id;viewButtons.appendChild(button);
    });
    const createButton=el('button','finder-toolbar-btn ical3-create','＋ 新事件');
    const todoButton=el('button','finder-toolbar-btn ical3-todo-toggle','✓ 待办事项');
    const spacer=el('i','ical3-toolbar-spacer');
    const search=el('input','aqua-input aqua-search ical3-search');
    search.placeholder='搜索 iCal';
    search.setAttribute('aria-label','搜索 iCal');
    toolbar.append(nav,viewButtons,createButton,todoButton,spacer,search);

    const root=el('div','ical3-app');
    const sidebar=el('aside','ical3-sidebar');
    const center=el('main','ical3-center');
    const centerHeader=el('header','ical3-center-header');
    const titleWrap=el('div');
    const title=el('h1');
    const subtitle=el('span');
    titleWrap.append(title,subtitle);
    const headerAction=el('button','aqua-btn ical3-header-add','＋');
    headerAction.title='在所选日期新建事件';
    centerHeader.append(titleWrap,headerAction);
    const viewHost=el('section','ical3-view-host');
    center.append(centerHeader,viewHost);
    const todoPanel=el('aside','ical3-todos');
    root.append(sidebar,center,todoPanel);

    const calendarFor=(id)=>state.calendars.find(calendar=>calendar.id===id)||state.calendars[0];
    const visibleCalendar=(id)=>calendarFor(id)?.visible!==false;
    const persist=()=>{
      state.version=3;state.lastView=view;state.selectedDate=selectedDate;state.todoVisible=todoVisible;
      try {localStorage.setItem(STORE_KEY,JSON.stringify(state));} catch(error){return false;}
      try {
        const mail=JSON.parse(localStorage.getItem(MAIL_KEY)||'{}')||{};
        mail.todos=state.todos.map(todo=>({...todo}));
        localStorage.setItem(MAIL_KEY,JSON.stringify(mail));
      } catch(error){}
      document.dispatchEvent(new CustomEvent('ical-data-changed',{detail:{events:state.events,todos:state.todos}}));
      return true;
    };
    const startDayIndex=()=>preferences.weekStarts==='saturday'?6:preferences.weekStarts==='sunday'?0:1;
    const startOfWeek=(date)=>{
      const result=new Date(date);
      const delta=(result.getDay()-startDayIndex()+7)%7;
      result.setDate(result.getDate()-delta);
      return result;
    };
    const weekdayLabels=()=>{
      const labels=['日','一','二','三','四','五','六'];
      const start=startDayIndex();
      return Array.from({length:7},(_,index)=>labels[(start+index)%7]);
    };
    const allStoredEvents=()=>Object.entries(state.events).flatMap(([base,events])=>events.map(event=>({event,base})));
    const findStored=(id)=>{
      for(const [base,events] of Object.entries(state.events)){
        const index=events.findIndex(event=>String(event.id)===String(id));
        if(index>=0)return {base,index,event:events[index]};
      }
      return null;
    };
    const occurrenceMatches=(event,base,target)=>{
      const difference=dayDiff(target,base);
      if(difference<0)return false;
      if(event.repeat==='none'){
        const end=event.endDate&&event.endDate>=base?event.endDate:base;
        return target>=base&&target<=end;
      }
      if(event.repeat==='daily')return true;
      if(event.repeat==='weekly')return difference%7===0;
      const baseDate=dateOf(base),targetDate=dateOf(target);
      if(event.repeat==='monthly')return targetDate.getDate()===baseDate.getDate();
      if(event.repeat==='yearly')return targetDate.getMonth()===baseDate.getMonth()&&targetDate.getDate()===baseDate.getDate();
      return false;
    };
    const birthdaysFor=(dateKey)=>{
      if(preferences.showBirthdays===false)return [];
      let contacts=[];
      try {contacts=JSON.parse(localStorage.getItem('macweb.addressbook.v1')||'[]')||[];}catch(error){}
      const monthDay=dateKey.slice(5);
      return contacts.filter(contact=>String(contact.birthday||'').slice(-5)===monthDay).map(contact=>({
        event:{id:`birthday-${contact.id||contact.first||contact.last}`,title:`${contact.last||''}${contact.first||''}的生日`,allDay:true,birthday:true,calendarId:'birthdays',repeat:'yearly',location:'',notes:'来自通讯录',attendees:[],attachments:[]},
        base:dateKey,occurrence:dateKey,
      }));
    };
    const eventsFor=(dateKey)=>[
      ...allStoredEvents().filter(({event,base})=>visibleCalendar(event.calendarId)&&occurrenceMatches(event,base,dateKey))
        .map(item=>({...item,occurrence:dateKey})),
      ...birthdaysFor(dateKey),
    ].sort((left,right)=>{
      if(!!left.event.allDay!==!!right.event.allDay)return left.event.allDay?-1:1;
      return timeMinutes(left.event.start)-timeMinutes(right.event.start)||left.event.title.localeCompare(right.event.title,'zh-CN');
    });
    const selectedStored=()=>findStored(selectedEventId);
    const dateLabel=(dateKey,options={})=>dateOf(dateKey).toLocaleDateString('zh-CN',{
      year:options.year===false?undefined:'numeric',month:options.short?'short':'long',day:'numeric',weekday:options.weekday===false?undefined:'long',
    });
    const eventTimeLabel=(event,occurrence)=>{
      if(event.allDay)return `${dateLabel(occurrence)} · 全天`;
      return `${dateLabel(occurrence)} · ${event.start}–${event.end}`;
    };
    const closePopover=()=>{
      popover?.remove();popover=null;
      center.classList.remove('popover-open');
    };
    const updateWindowState=()=>{
      if(!win)return;
      win.dataset.icalView=view;
      win.dataset.icalTodoVisible=String(todoVisible);
      win.dataset.icalEventSelected=String(!!selectedEventId);
      win.dataset.icalCanDeleteCalendar=String(!!calendarFor(selectedCalendar)&&!calendarFor(selectedCalendar).builtIn);
      win.dataset.icalSearch=String(!!query);
      win.dataset.icalHasEvents=String(allStoredEvents().length>0);
    };
    const setSelectedEvent=(id,occurrence)=>{
      selectedEventId=String(id||'');
      selectedOccurrence=occurrence||selectedDate;
      selectedDate=selectedOccurrence;
      renderView();
      renderTodos();
      updateWindowState();
    };
    const colorForEvent=(event)=>event.birthday?'#9e64b8':calendarFor(event.calendarId)?.color||'#4f8fd4';

    function showEventPopover(anchor,id,occurrence){
      closePopover();
      const stored=findStored(id);
      const event=stored?.event;
      if(!event||!anchor?.isConnected)return;
      const calendar=calendarFor(event.calendarId);
      popover=el('section','ical3-event-popover');
      popover.style.setProperty('--ical-popover-color',colorForEvent(event));
      popover.innerHTML=`<header><i></i><div><h2>${escapeHtml(event.title)}</h2><span>${escapeHtml(calendar?.name||'个人')}</span></div><button aria-label="关闭">×</button></header>
        <dl><dt>时间</dt><dd>${escapeHtml(eventTimeLabel(event,occurrence))}${event.repeat!=='none'?`<small>重复：${({daily:'每天',weekly:'每周',monthly:'每月',yearly:'每年'})[event.repeat]}</small>`:''}</dd>
        ${event.location?`<dt>地点</dt><dd>${escapeHtml(event.location)}</dd>`:''}
        <dt>提醒</dt><dd>${escapeHtml(({none:'无', 'at-time':'事件开始时','5m':'提前 5 分钟','15m':'提前 15 分钟','1h':'提前 1 小时','1d':'提前 1 天'})[event.alarm]||'无')}</dd>
        ${event.attendees.length?`<dt>受邀人</dt><dd>${event.attendees.map(escapeHtml).join('<br>')}</dd>`:''}
        ${event.attachments.length?`<dt>附件</dt><dd class="ical3-popover-attachments">${event.attachments.map(path=>`<button data-attachment="${escapeHtml(path)}">${escapeHtml(VFS.baseName(path))}</button>`).join('')}</dd>`:''}
        ${event.notes?`<dt>备注</dt><dd>${escapeHtml(event.notes).replace(/\n/g,'<br>')}</dd>`:''}</dl>
        <footer><button class="aqua-btn" data-event-action="availability" ${event.attendees.length?'':'disabled'}>可用性…</button><i></i><button class="aqua-btn" data-event-action="delete">删除</button><button class="aqua-btn default" data-event-action="edit">编辑</button></footer>`;
      center.appendChild(popover);
      center.classList.add('popover-open');
      const anchorRect=anchor.getBoundingClientRect();
      const centerRect=center.getBoundingClientRect();
      const width=310;
      let left=anchorRect.right-centerRect.left+9;
      if(left+width>centerRect.width-8)left=Math.max(8,anchorRect.left-centerRect.left-width-9);
      let top=anchorRect.top-centerRect.top-14;
      top=Math.max(10,Math.min(top,centerRect.height-popover.offsetHeight-10));
      popover.style.left=`${left}px`;popover.style.top=`${top}px`;
      popover.querySelector('header button').addEventListener('click',()=>{selectedEventId='';closePopover();updateWindowState();});
      popover.querySelector('[data-event-action="edit"]').addEventListener('click',()=>openEventEditor(stored,occurrence));
      popover.querySelector('[data-event-action="delete"]').addEventListener('click',()=>deleteEvent(stored));
      popover.querySelector('[data-event-action="availability"]').addEventListener('click',()=>showAvailability(stored));
      popover.querySelectorAll('[data-attachment]').forEach(button=>button.addEventListener('click',()=>System.openVfsPath?.(button.dataset.attachment)));
    }

    const attachEventButton=(button,item)=>{
      const {event,occurrence}=item;
      button.dataset.eventId=event.id;
      button.dataset.occurrence=occurrence;
      button.style.setProperty('--ical-event-color',colorForEvent(event));
      if(String(event.id)===selectedEventId)button.classList.add('selected');
      button.addEventListener('click',(clickEvent)=>{
        clickEvent.stopPropagation();
        selectedEventId=String(event.id);selectedOccurrence=occurrence;selectedDate=occurrence;
        renderView();renderTodos();updateWindowState();
      });
      if(!event.birthday){
        button.addEventListener('dblclick',(doubleEvent)=>{
          doubleEvent.stopPropagation();
          const stored=findStored(event.id);if(stored)openEventEditor(stored,occurrence);
        });
        button.draggable=true;
        button.addEventListener('dragstart',(dragEvent)=>{
          dragEvent.dataTransfer.effectAllowed='move';
          dragEvent.dataTransfer.setData('text/x-ical-event',String(event.id));
        });
      }
    };
    const openSelectedPopover=()=>{
      if(!selectedEventId)return;
      requestAnimationFrame(()=>{
        const anchor=viewHost.querySelector(`[data-event-id="${CSS.escape(selectedEventId)}"][data-occurrence="${CSS.escape(selectedOccurrence)}"]`)
          ||viewHost.querySelector(`[data-event-id="${CSS.escape(selectedEventId)}"]`);
        if(anchor)showEventPopover(anchor,selectedEventId,selectedOccurrence);
      });
    };

    function renderSidebar(){
      sidebar.innerHTML='<header><b>日历</b><button class="ical3-sidebar-hide" title="隐藏日历列表">◀</button></header><div class="ical3-calendar-groups"></div><footer><button data-calendar-action="add" title="新建日历">＋</button><button data-calendar-action="remove" title="删除日历">－</button><i></i><button data-calendar-action="menu" title="日历操作">⚙</button></footer>';
      const groups=sidebar.querySelector('.ical3-calendar-groups');
      const grouped=new Map();
      state.calendars.forEach(calendar=>{
        const group=calendar.account==='subscriptions'?'订阅':calendar.account==='workgroup'?'工作组':'在我的 Mac 上';
        if(!grouped.has(group))grouped.set(group,[]);
        grouped.get(group).push(calendar);
      });
      grouped.forEach((calendars,label)=>{
        const section=el('section');
        section.innerHTML=`<h3>${escapeHtml(label)}</h3>`;
        calendars.forEach(calendar=>{
          const row=el('label',calendar.id===selectedCalendar?'selected':'');
          row.dataset.calendarId=calendar.id;
          row.innerHTML=`<input type="checkbox" ${calendar.visible!==false?'checked':''}><i style="--calendar-color:${escapeHtml(calendar.color)}"></i><span>${escapeHtml(calendar.name)}</span>${calendar.subscribed?'<em title="已订阅">⌁</em>':''}`;
          row.querySelector('input').addEventListener('click',event=>event.stopPropagation());
          row.querySelector('input').addEventListener('change',event=>{
            calendar.visible=event.target.checked;persist();renderView();renderTodos();
          });
          row.addEventListener('click',()=>{
            selectedCalendar=calendar.id;renderSidebar();updateWindowState();
          });
          section.appendChild(row);
        });
        groups.appendChild(section);
      });
      if(preferences.showBirthdays!==false){
        const birthdays=el('section');
        birthdays.innerHTML='<h3>其他</h3><label class="ical3-birthday-calendar"><input type="checkbox" checked disabled><i></i><span>生日</span></label>';
        groups.appendChild(birthdays);
      }
      sidebar.querySelector('[data-calendar-action="add"]').addEventListener('click',createCalendar);
      sidebar.querySelector('[data-calendar-action="remove"]').addEventListener('click',removeCalendar);
      sidebar.querySelector('[data-calendar-action="menu"]').addEventListener('click',event=>System.contextMenu(event,[
        {label:'新建日历…',action:createCalendar},
        {label:'订阅日历…',action:subscribeCalendar},
        {sep:true},
        {label:'导入…',action:importICS},
        {label:'导出…',action:exportICS},
      ]));
      sidebar.querySelector('.ical3-sidebar-hide').addEventListener('click',()=>{
        root.classList.add('calendars-hidden');
        const show=el('button','ical3-show-calendars','▶');
        show.title='显示日历列表';root.appendChild(show);
        show.addEventListener('click',()=>{root.classList.remove('calendars-hidden');show.remove();});
      });
    }

    function renderMonth(){
      const chosen=dateOf(selectedDate);
      const first=new Date(chosen.getFullYear(),chosen.getMonth(),1,12);
      const offset=(first.getDay()-startDayIndex()+7)%7;
      const start=addDays(first,-offset);
      const monthView=el('div','ical3-month');
      const grid=el('div','ical3-month-grid');
      if(preferences.showWeekNumbers)grid.classList.add('week-numbers');
      if(preferences.showWeekNumbers)grid.appendChild(el('div','ical3-month-dow week','周'));
      weekdayLabels().forEach(label=>grid.appendChild(el('div','ical3-month-dow',label)));
      const todayKey=keyOf(new Date());
      for(let week=0;week<6;week++){
        if(preferences.showWeekNumbers){
          const weekDate=addDays(start,week*7+3);
          const firstThursday=new Date(weekDate.getFullYear(),0,4,12);
          const weekOne=startOfWeek(firstThursday);
          const number=Math.floor((weekDate-weekOne)/604800000)+1;
          grid.appendChild(el('div','ical3-week-number',String(number)));
        }
        for(let day=0;day<7;day++){
          const date=addDays(start,week*7+day);
          const dateKey=keyOf(date);
          const cell=el('div','ical3-month-day');
          cell.dataset.date=dateKey;
          if(date.getMonth()!==chosen.getMonth())cell.classList.add('other');
          if(dateKey===todayKey)cell.classList.add('today');
          if(dateKey===selectedDate)cell.classList.add('selected');
          const number=el('button','ical3-day-number',String(date.getDate()));
          number.title=dateLabel(dateKey);
          cell.appendChild(number);
          const eventList=el('div','ical3-month-events');
          const items=eventsFor(dateKey);
          items.slice(0,4).forEach(item=>{
            const eventButton=el('button','ical3-month-event');
            eventButton.textContent=`${item.event.allDay?'':`${item.event.start} `}${item.event.title}`;
            attachEventButton(eventButton,item);eventList.appendChild(eventButton);
          });
          if(items.length>4){
            const more=el('button','ical3-more-events',`还有 ${items.length-4} 个…`);
            more.addEventListener('click',event=>{event.stopPropagation();selectedDate=dateKey;view='day';persist();render();});
            eventList.appendChild(more);
          }
          cell.appendChild(eventList);
          cell.addEventListener('click',()=>{
            selectedDate=dateKey;selectedEventId='';closePopover();persist();renderView();renderTodos();
          });
          cell.addEventListener('dblclick',event=>{
            if(event.target.closest('[data-event-id],.ical3-more-events'))return;
            selectedDate=dateKey;openEventEditor(null,dateKey);
          });
          cell.addEventListener('dragover',event=>{if(event.dataTransfer.types.includes('text/x-ical-event')){event.preventDefault();cell.classList.add('drag-over');}});
          cell.addEventListener('dragleave',()=>cell.classList.remove('drag-over'));
          cell.addEventListener('drop',event=>{
            event.preventDefault();cell.classList.remove('drag-over');
            moveEventToDate(event.dataTransfer.getData('text/x-ical-event'),dateKey);
          });
          grid.appendChild(cell);
        }
      }
      monthView.appendChild(grid);viewHost.appendChild(monthView);
    }

    function renderTimeline(dayCount){
      const selected=dateOf(selectedDate);
      const start=dayCount===7?startOfWeek(selected):selected;
      const dates=Array.from({length:dayCount},(_,index)=>addDays(start,index));
      const timeline=el('div',`ical3-timeline ${dayCount===1?'day':'week'}`);
      timeline.style.setProperty('--ical-day-count',dayCount);
      const headers=el('div','ical3-timeline-headers');
      headers.appendChild(el('div','ical3-time-corner',preferences.timeZoneSupport===false?'本地':Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').at(-1)));
      dates.forEach(date=>{
        const dateKey=keyOf(date);
        const button=el('button',dateKey===selectedDate?'selected':'');
        button.innerHTML=`<span>${date.toLocaleDateString('zh-CN',{weekday:'short'})}</span><b>${date.getMonth()+1}月${date.getDate()}日</b>`;
        if(dateKey===keyOf(new Date()))button.classList.add('today');
        button.addEventListener('click',()=>{selectedDate=dateKey;selectedEventId='';persist();renderView();renderTodos();});
        headers.appendChild(button);
      });
      const allDay=el('div','ical3-all-day-row');
      allDay.appendChild(el('div','ical3-all-day-label','全天'));
      dates.forEach(date=>{
        const dateKey=keyOf(date);
        const column=el('div','ical3-all-day-column');
        eventsFor(dateKey).filter(item=>item.event.allDay).forEach(item=>{
          const button=el('button','ical3-all-day-event',item.event.title);
          attachEventButton(button,item);column.appendChild(button);
        });
        column.addEventListener('dblclick',event=>{if(!event.target.closest('[data-event-id]'))openEventEditor(null,dateKey,'09:00',{allDay:true});});
        allDay.appendChild(column);
      });
      const scroll=el('div','ical3-timeline-scroll');
      const timeAxis=el('div','ical3-time-axis');
      for(let hour=0;hour<24;hour++)timeAxis.appendChild(el('div','',hour?`${pad(hour)}:00`:'午夜'));
      scroll.appendChild(timeAxis);
      const dayArea=el('div','ical3-time-days');
      dates.forEach(date=>{
        const dateKey=keyOf(date);
        const column=el('div','ical3-time-day');
        column.dataset.date=dateKey;
        if(dateKey===keyOf(new Date()))column.classList.add('today');
        eventsFor(dateKey).filter(item=>!item.event.allDay).forEach(item=>{
          const startMinute=timeMinutes(item.event.start);
          const endMinute=Math.max(startMinute+15,timeMinutes(item.event.end));
          const button=el('button','ical3-time-event');
          button.style.top=`${startMinute/60*HOUR_HEIGHT}px`;
          button.style.height=`${Math.max(19,(endMinute-startMinute)/60*HOUR_HEIGHT)}px`;
          button.innerHTML=`<b>${escapeHtml(item.event.title)}</b><span>${escapeHtml(item.event.start)}${item.event.location?` · ${escapeHtml(item.event.location)}`:''}</span>`;
          attachEventButton(button,item);column.appendChild(button);
        });
        if(dateKey===keyOf(new Date())){
          const now=new Date();
          const line=el('i','ical3-now-line');
          line.style.top=`${(now.getHours()*60+now.getMinutes())/60*HOUR_HEIGHT}px`;
          column.appendChild(line);
        }
        column.addEventListener('dblclick',event=>{
          if(event.target.closest('[data-event-id]'))return;
          const rect=column.getBoundingClientRect();
          const minutes=Math.round(((event.clientY-rect.top)/HOUR_HEIGHT*60)/15)*15;
          openEventEditor(null,dateKey,timeOf(Math.max(0,Math.min(1425,minutes))));
        });
        dayArea.appendChild(column);
      });
      scroll.appendChild(dayArea);
      timeline.append(headers,allDay,scroll);viewHost.appendChild(timeline);
      requestAnimationFrame(()=>{scroll.scrollTop=Math.max(0,(Number(preferences.dayStarts)||8)*HOUR_HEIGHT-18);});
    }

    function renderSearch(){
      const normalized=query.trim().toLocaleLowerCase('zh-CN');
      const matches=allStoredEvents().filter(({event})=>
        `${event.title} ${event.location} ${event.notes} ${event.attendees.join(' ')}`.toLocaleLowerCase('zh-CN').includes(normalized));
      const todoMatches=state.todos.filter(todo=>`${todo.title} ${todo.notes}`.toLocaleLowerCase('zh-CN').includes(normalized));
      const results=el('div','ical3-search-results');
      results.innerHTML=`<header><h2>“${escapeHtml(query)}”的搜索结果</h2><span>${matches.length} 个事件，${todoMatches.length} 个待办事项</span></header>`;
      const list=el('div');
      matches.sort((left,right)=>left.base.localeCompare(right.base)||left.event.start.localeCompare(right.event.start)).forEach(item=>{
        const button=el('button','ical3-search-result');
        button.innerHTML=`<i style="--ical-event-color:${escapeHtml(colorForEvent(item.event))}"></i><span><b>${escapeHtml(item.event.title)}</b><small>${escapeHtml(eventTimeLabel(item.event,item.base))}${item.event.location?` · ${escapeHtml(item.event.location)}`:''}</small></span><em>事件</em>`;
        button.addEventListener('click',()=>{query='';search.value='';selectedDate=item.base;selectedEventId=item.event.id;selectedOccurrence=item.base;render();});
        list.appendChild(button);
      });
      todoMatches.forEach(todo=>{
        const button=el('button','ical3-search-result todo');
        button.innerHTML=`<i></i><span><b>${escapeHtml(todo.title)}</b><small>${todo.due?escapeHtml(dateLabel(todo.due)):'没有到期日'}</small></span><em>待办</em>`;
        button.addEventListener('click',()=>openTodoEditor(todo));
        list.appendChild(button);
      });
      if(!matches.length&&!todoMatches.length)list.innerHTML='<div class="ical3-no-results">没有找到匹配项目。尝试标题、地点、受邀人或备注中的其他词语。</div>';
      results.appendChild(list);viewHost.appendChild(results);
    }

    function renderView(){
      closePopover();viewHost.innerHTML='';
      root.classList.toggle('todos-hidden',!todoVisible);
      viewButtons.querySelectorAll('button').forEach(button=>button.classList.toggle('selected',button.dataset.view===view));
      if(query){
        title.textContent='搜索结果';subtitle.textContent=`在所有日历中搜索“${query}”`;
        renderSearch();updateWindowState();return;
      }
      const selected=dateOf(selectedDate);
      if(view==='month'){
        title.textContent=`${selected.getFullYear()} 年 ${selected.getMonth()+1} 月`;
        subtitle.textContent=`${dateLabel(selectedDate,{year:false})} · ${eventsFor(selectedDate).length} 个事件`;
        renderMonth();
      }else if(view==='week'){
        const start=startOfWeek(selected),end=addDays(start,6);
        title.textContent=start.getMonth()===end.getMonth()
          ? `${start.getFullYear()} 年 ${start.getMonth()+1} 月 ${start.getDate()}–${end.getDate()} 日`
          : `${start.getMonth()+1} 月 ${start.getDate()} 日 – ${end.getMonth()+1} 月 ${end.getDate()} 日`;
        subtitle.textContent=`周视图 · ${dateLabel(selectedDate,{year:false})}`;
        renderTimeline(7);
      }else{
        title.textContent=dateLabel(selectedDate);
        subtitle.textContent=`日视图 · ${eventsFor(selectedDate).length} 个事件`;
        renderTimeline(1);
      }
      openSelectedPopover();updateWindowState();
    }

    function renderTodos(){
      todoPanel.innerHTML='<header><div><b>待办事项</b><span>与 Mail 同步</span></div><button class="ical3-close-todos" title="隐藏待办事项">×</button></header><div class="ical3-todo-list"></div><footer><button class="aqua-btn ical3-new-todo">＋</button><span></span><button class="aqua-btn ical3-clear-todos">清除已完成</button></footer>';
      const list=todoPanel.querySelector('.ical3-todo-list');
      const items=state.todos.slice().sort((left,right)=>Number(left.done)-Number(right.done)||(left.due||'9999').localeCompare(right.due||'9999'));
      if(!items.length)list.innerHTML='<div class="ical3-empty-todos"><b>没有待办事项</b><span>点按“＋”添加，项目会同时显示在 Mail 中。</span></div>';
      items.forEach(todo=>{
        const row=el('article',todo.done?'done':'');
        row.dataset.todoId=todo.id;
        const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=todo.done;
        const body=el('button','ical3-todo-body');
        const calendar=calendarFor(todo.calendarId);
        body.innerHTML=`<b>${escapeHtml(todo.title)}</b><small>${todo.due?escapeHtml(dateLabel(todo.due,{year:false})):'没有到期日'} · ${escapeHtml(calendar?.name||'个人')}</small>`;
        const priority=el('i',`ical3-priority ${todo.priority||'none'}`,todo.priority==='high'?'!!!':todo.priority==='medium'?'!!':todo.priority==='low'?'!':'');
        checkbox.addEventListener('change',()=>{todo.done=checkbox.checked;persist();renderTodos();});
        body.addEventListener('click',()=>openTodoEditor(todo));
        row.append(checkbox,body,priority);list.appendChild(row);
      });
      todoPanel.querySelector('.ical3-close-todos').addEventListener('click',()=>{todoVisible=false;persist();render();});
      todoPanel.querySelector('.ical3-new-todo').addEventListener('click',()=>openTodoEditor());
      todoPanel.querySelector('.ical3-clear-todos').addEventListener('click',()=>{
        const completed=state.todos.filter(todo=>todo.done).length;
        if(!completed){Leopard.toast('iCal','没有已完成的待办事项。');return;}
        System.confirmSheet({parent:win,headline:`清除 ${completed} 个已完成的待办事项？`,message:'这些项目也会从 Mail 的待办事项中移除。',okLabel:'清除',danger:true,onOK:()=>{
          state.todos=state.todos.filter(todo=>!todo.done);persist();renderTodos();
        }});
      });
    }

    function render(){
      renderSidebar();renderTodos();renderView();
      root.classList.toggle('todos-hidden',!todoVisible);
      todoButton.classList.toggle('active',todoVisible);
      const eventCount=allStoredEvents().length;
      if(win?._status)win._status.textContent=`${eventCount} 个事件 · ${state.todos.filter(todo=>!todo.done).length} 个未完成待办 · ${preferences.timeZoneSupport===false?'本地时间':Intl.DateTimeFormat().resolvedOptions().timeZone}`;
      updateWindowState();
    }

    function collectEventDraft(form,draft){
      const value=(name)=>form.querySelector(`[name="${name}"]`)?.value||'';
      return {
        ...draft,title:value('title').trim(),location:value('location').trim(),
        date:value('date'),endDate:value('endDate')||value('date'),
        start:value('start')||'09:00',end:value('end')||'10:00',
        allDay:!!form.querySelector('[name="allDay"]')?.checked,
        calendarId:value('calendarId')||selectedCalendar,
        repeat:value('repeat')||'none',alarm:value('alarm')||'none',
        attendees:value('attendees').split(/[,;\n]/).map(item=>item.trim()).filter(Boolean),
        notes:value('notes'),url:value('url').trim(),
        attachments:(draft.attachments||[]).filter(path=>VFS.get(path)?.type==='file'),
      };
    }
    function openEventEditor(stored,occurrence=selectedDate,initialTime='09:00',draftOverride=null){
      closePopover();
      const existing=stored?.event;
      let draft=draftOverride?clone(draftOverride):existing?clone(existing):normalizeEvent({
        id:eventId(),title:'',date:occurrence,endDate:occurrence,start:initialTime,
        end:timeOf(Math.min(1439,timeMinutes(initialTime)+60)),calendarId:selectedCalendar,
        alarm:({none:'none','0':'at-time','5':'5m','15':'15m','60':'1h','1440':'1d'})[String(preferences.defaultAlarm||'15')]||'15m',
      },occurrence);
      const form=el('div','ical3-event-editor');
      const calendarOptions=state.calendars.filter(calendar=>!calendar.readOnly).map(calendar=>`<option value="${escapeHtml(calendar.id)}" ${calendar.id===draft.calendarId?'selected':''}>${escapeHtml(calendar.name)}</option>`).join('');
      form.innerHTML=`<div class="ical3-event-editor-title"><i style="--calendar-color:${escapeHtml(colorForEvent(draft))}"></i><input class="aqua-input" name="title" value="${escapeHtml(draft.title)}" placeholder="新事件"></div>
        <div class="ical3-event-form">
          <label><span>地点：</span><input class="aqua-input" name="location" value="${escapeHtml(draft.location)}" placeholder="可选"></label>
          <label><span>日历：</span><select class="aqua-select" name="calendarId">${calendarOptions}</select></label>
          <label class="ical3-all-day-control"><span></span><input type="checkbox" name="allDay" ${draft.allDay?'checked':''}> 全天事件</label>
          <label><span>开始：</span><div class="ical3-date-time"><input class="aqua-input" type="date" name="date" value="${escapeHtml(draft.date)}"><input class="aqua-input" type="time" name="start" value="${escapeHtml(draft.start)}"></div></label>
          <label><span>结束：</span><div class="ical3-date-time"><input class="aqua-input" type="date" name="endDate" value="${escapeHtml(draft.endDate||draft.date)}"><input class="aqua-input" type="time" name="end" value="${escapeHtml(draft.end)}"></div></label>
          <label><span>重复：</span><select class="aqua-select" name="repeat"><option value="none">无</option><option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option><option value="yearly">每年</option></select></label>
          <label><span>提醒：</span><select class="aqua-select" name="alarm"><option value="none">无</option><option value="at-time">事件开始时</option><option value="5m">提前 5 分钟</option><option value="15m">提前 15 分钟</option><option value="1h">提前 1 小时</option><option value="1d">提前 1 天</option></select></label>
          <label><span>受邀人：</span><textarea class="aqua-input compact" name="attendees" placeholder="用逗号分隔电子邮件地址">${escapeHtml(draft.attendees.join(', '))}</textarea></label>
          <label><span>URL：</span><input class="aqua-input" name="url" value="${escapeHtml(draft.url)}" placeholder="https://…"></label>
          <label><span>备注：</span><textarea class="aqua-input" name="notes" placeholder="可选备注">${escapeHtml(draft.notes)}</textarea></label>
        </div>
        <section class="ical3-attachment-editor"><header><b>附件</b><button class="aqua-btn" type="button" data-add-attachment>添加…</button></header><div>${draft.attachments.map(path=>`<article><button type="button" data-open-attachment="${escapeHtml(path)}">${System.fileIconFor?.(path)||'📄'}<span>${escapeHtml(VFS.baseName(path))}</span></button><button type="button" data-remove-attachment="${escapeHtml(path)}" aria-label="移除">×</button></article>`).join('')||'<p>没有附件</p>'}</div></section>
        <div class="ical3-event-editor-error"></div>`;
      form.querySelector('[name="repeat"]').value=draft.repeat;
      form.querySelector('[name="alarm"]').value=draft.alarm;
      const allDay=form.querySelector('[name="allDay"]');
      const syncAllDay=()=>form.querySelectorAll('input[type="time"]').forEach(input=>input.disabled=allDay.checked);
      allDay.addEventListener('change',syncAllDay);syncAllDay();
      let sheetApi=null;
      const reopenAfterPicker=(picked)=>{
        setTimeout(()=>openEventEditor(stored,occurrence,initialTime,draft),picked?180:120);
      };
      form.querySelector('[data-add-attachment]').addEventListener('click',()=>{
        draft=collectEventDraft(form,draft);
        sheetApi?.close('attach');
        let picked=false;
        setTimeout(()=>System.openPanel({
          parent:win,title:'选择事件附件',startPath:'/用户/roll/文稿',allowMultiple:true,allowUpload:true,
          onOpen:(paths)=>{
            picked=true;
            const additions=(Array.isArray(paths)?paths:[paths]).filter(path=>VFS.get(path)?.type==='file');
            draft.attachments=[...new Set([...draft.attachments,...additions])];
            reopenAfterPicker(true);return true;
          },
          onClose:reason=>{if(!picked&&reason!=='accept')reopenAfterPicker(false);},
        }),170);
      });
      form.querySelectorAll('[data-open-attachment]').forEach(button=>button.addEventListener('click',()=>System.openVfsPath?.(button.dataset.openAttachment)));
      form.querySelectorAll('[data-remove-attachment]').forEach(button=>button.addEventListener('click',()=>{
        draft=collectEventDraft(form,draft);
        draft.attachments=draft.attachments.filter(path=>path!==button.dataset.removeAttachment);
        sheetApi?.close('remove-attachment');
        reopenAfterPicker(true);
      }));
      const saveEvent=()=>{
        draft=collectEventDraft(form,draft);
        const error=form.querySelector('.ical3-event-editor-error');
        if(!draft.title){error.textContent='请输入事件名称。';form.querySelector('[name="title"]').focus();return false;}
        if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)||draft.endDate<draft.date){error.textContent='结束日期不能早于开始日期。';return false;}
        if(!draft.allDay&&draft.endDate===draft.date&&timeMinutes(draft.end)<=timeMinutes(draft.start)){error.textContent='结束时间必须晚于开始时间。';return false;}
        draft.modifiedAt=Date.now();
        if(stored){
          const current=findStored(stored.event.id);
          if(current){
            state.events[current.base].splice(current.index,1);
            if(!state.events[current.base].length)delete state.events[current.base];
          }
        }
        (state.events[draft.date]=state.events[draft.date]||[]).push(normalizeEvent(draft,draft.date));
        selectedDate=draft.date;selectedEventId=draft.id;selectedOccurrence=draft.date;
        selectedCalendar=draft.calendarId;persist();render();
        Leopard.toast('iCal',stored?'事件已经更新。':'事件已经添加。');
        return true;
      };
      sheetApi=System.showSheet({
        parent:win,title:stored?'编辑事件':'新建事件',content:form,className:'ical3-event-sheet',
        initialFocus:form.querySelector('[name="title"]'),
        buttons:[
          {label:'取消',cancel:true},
          ...(stored?[{label:'删除',danger:true,action:()=>{setTimeout(()=>deleteEvent(stored),170);}}]:[]),
          {label:stored?'完成':'添加',default:true,action:saveEvent},
        ],
      });
      requestAnimationFrame(()=>{const input=form.querySelector('[name="title"]');input.focus();input.select();});
    }

    function deleteEvent(stored){
      if(!stored)return;
      closePopover();
      System.confirmSheet({
        parent:win,headline:`删除事件“${stored.event.title}”？`,
        message:stored.event.repeat!=='none'?'这会删除整个重复事件。':'此操作可以通过重新建立事件来恢复。',
        okLabel:'删除',danger:true,onOK:()=>{
          const current=findStored(stored.event.id);
          if(!current)return;
          state.events[current.base].splice(current.index,1);
          if(!state.events[current.base].length)delete state.events[current.base];
          selectedEventId='';persist();render();
        },
      });
    }
    function duplicateEvent(){
      const stored=selectedStored();if(!stored)return;
      const copy=normalizeEvent({...clone(stored.event),id:eventId(),title:`${stored.event.title} 副本`,createdAt:Date.now()},stored.base);
      (state.events[stored.base]=state.events[stored.base]||[]).push(copy);
      selectedEventId=copy.id;selectedOccurrence=stored.base;persist();render();
    }
    function moveEventToDate(id,dateKey){
      const stored=findStored(id);if(!stored||stored.event.repeat!=='none')return;
      const offset=dayDiff(dateKey,stored.base);
      const moved=clone(stored.event);
      moved.date=dateKey;
      moved.endDate=keyOf(addDays(dateOf(moved.endDate||stored.base),offset));
      state.events[stored.base].splice(stored.index,1);
      if(!state.events[stored.base].length)delete state.events[stored.base];
      (state.events[dateKey]=state.events[dateKey]||[]).push(moved);
      selectedDate=dateKey;selectedEventId=moved.id;selectedOccurrence=dateKey;persist();render();
    }

    function openTodoEditor(existing){
      const draft=existing?clone(existing):{id:eventId(),title:'',due:selectedDate,calendarId:selectedCalendar,done:false,priority:'none',notes:''};
      const form=el('div','ical3-todo-editor');
      form.innerHTML=`<label><span>待办事项：</span><input class="aqua-input" name="title" value="${escapeHtml(draft.title)}"></label>
        <label><span>到期日：</span><input class="aqua-input" type="date" name="due" value="${escapeHtml(draft.due)}"></label>
        <label><span>日历：</span><select class="aqua-select" name="calendarId">${state.calendars.filter(calendar=>!calendar.readOnly).map(calendar=>`<option value="${escapeHtml(calendar.id)}" ${calendar.id===draft.calendarId?'selected':''}>${escapeHtml(calendar.name)}</option>`).join('')}</select></label>
        <label><span>优先级：</span><select class="aqua-select" name="priority"><option value="none">无</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label>
        <label><span>备注：</span><textarea class="aqua-input" name="notes">${escapeHtml(draft.notes)}</textarea></label>
        <label class="ical3-todo-complete"><span></span><input type="checkbox" name="done" ${draft.done?'checked':''}> 已完成</label><div class="ical3-todo-error"></div>`;
      form.querySelector('[name="priority"]').value=draft.priority;
      System.showSheet({
        parent:win,title:existing?'编辑待办事项':'新建待办事项',content:form,className:'ical3-todo-sheet',
        initialFocus:form.querySelector('[name="title"]'),
        buttons:[
          {label:'取消',cancel:true},
          ...(existing?[{label:'删除',danger:true,action:()=>{
            state.todos=state.todos.filter(todo=>todo.id!==existing.id);persist();renderTodos();
          }}]:[]),
          {label:existing?'完成':'添加',default:true,action:()=>{
            const titleValue=form.querySelector('[name="title"]').value.trim();
            if(!titleValue){form.querySelector('.ical3-todo-error').textContent='请输入待办事项名称。';return false;}
            Object.assign(draft,{
              title:titleValue,due:form.querySelector('[name="due"]').value,
              calendarId:form.querySelector('[name="calendarId"]').value,
              priority:form.querySelector('[name="priority"]').value,
              notes:form.querySelector('[name="notes"]').value,
              done:form.querySelector('[name="done"]').checked,
            });
            const index=state.todos.findIndex(todo=>todo.id===draft.id);
            if(index>=0)state.todos[index]=draft;else state.todos.push(draft);
            persist();renderTodos();updateWindowState();return true;
          }},
        ],
      });
    }

    function showAvailability(stored){
      const event=stored?.event;if(!event?.attendees.length)return;
      const pane=el('div','ical3-availability');
      const startHour=Math.max(8,Math.min(16,Math.floor(timeMinutes(event.start)/60)-1));
      const hours=Array.from({length:9},(_,index)=>startHour+index);
      const hash=(text)=>[...text].reduce((sum,char)=>(sum*31+char.charCodeAt(0))>>>0,7);
      pane.innerHTML=`<header><h3>受邀人可用性</h3><p>${escapeHtml(dateLabel(stored.base))} · 由本地 CalDAV 示例日程计算</p></header>
        <div class="ical3-availability-grid"><div></div>${hours.map(hour=>`<b>${pad(hour)}:00</b>`).join('')}
        ${event.attendees.map(attendee=>`<span title="${escapeHtml(attendee)}">${escapeHtml(attendee)}</span>${hours.map(hour=>{
          const busy=(hash(attendee)+hour*13+dateOf(stored.base).getDate())%5<2;
          return `<i class="${busy?'busy':'free'}" title="${busy?'忙碌':'空闲'}"></i>`;
        }).join('')}`).join('')}</div>
        <footer><i class="free"></i> 空闲 <i class="busy"></i> 忙碌 <span></span><button class="aqua-btn" data-next-available>下一个可用时间</button></footer>`;
      const findNext=()=>{
        for(const hour of hours){
          if(event.attendees.every(attendee=>(hash(attendee)+hour*13+dateOf(stored.base).getDate())%5>=2))return hour;
        }
        return null;
      };
      const api=System.showSheet({parent:win,title:'可用性',content:pane,className:'ical3-availability-sheet',buttons:[{label:'完成',default:true}]});
      pane.querySelector('[data-next-available]').addEventListener('click',()=>{
        const hour=findNext();
        if(hour==null){Leopard.toast('iCal','当天没有共同空闲的一小时。');return;}
        event.start=`${pad(hour)}:00`;event.end=`${pad(hour+1)}:00`;event.modifiedAt=Date.now();
        persist();api.close('accept');render();Leopard.toast('iCal',`已移到 ${pad(hour)}:00。`);
      });
    }

    function createCalendar(){
      System.promptSheet({
        parent:win,title:'新建日历',message:'日历名称：',value:'未命名日历',okLabel:'创建',
        validate:name=>state.calendars.some(calendar=>calendar.name.toLocaleLowerCase('zh-CN')===name.toLocaleLowerCase('zh-CN'))?'已经存在同名日历。':true,
        onOK:name=>{
          const palette=['#7d63b4','#dc8a3a','#40a66b','#c85d93','#4ba5a5'];
          const calendar={id:`calendar-${Date.now()}`,name,color:palette[state.calendars.length%palette.length],visible:true,builtIn:false,account:'onmy'};
          state.calendars.push(calendar);selectedCalendar=calendar.id;persist();render();return true;
        },
      });
    }
    function removeCalendar(){
      const calendar=calendarFor(selectedCalendar);
      if(!calendar||calendar.builtIn){Leopard.toast('iCal','内建日历不能删除。');return;}
      const count=allStoredEvents().filter(item=>item.event.calendarId===calendar.id).length;
      System.confirmSheet({
        parent:win,headline:`删除日历“${calendar.name}”？`,
        message:`其中的 ${count} 个事件和关联待办事项会移到“个人”日历。`,
        okLabel:'删除',danger:true,onOK:()=>{
          allStoredEvents().forEach(({event})=>{if(event.calendarId===calendar.id)event.calendarId='home';});
          state.todos.forEach(todo=>{if(todo.calendarId===calendar.id)todo.calendarId='home';});
          state.calendars=state.calendars.filter(item=>item.id!==calendar.id);
          selectedCalendar='home';persist();render();
        },
      });
    }
    function subscribeCalendar(){
      System.promptSheet({
        parent:win,title:'订阅日历',message:'请输入 CalDAV 或 iCalendar 地址：',placeholder:'https://example.com/calendar.ics',okLabel:'订阅',
        validate:value=>{try{const url=new URL(value);return /^https?:$/.test(url.protocol)||'请输入 http 或 https 地址。';}catch(error){return '请输入有效地址。';}},
        onOK:value=>{
          let name='已订阅日历';try{name=new URL(value).hostname;}catch(error){}
          const calendar={id:`subscription-${Date.now()}`,name,color:'#4ba7a0',visible:true,builtIn:false,account:'subscriptions',subscribed:true,readOnly:true,url:value};
          state.calendars.push(calendar);selectedCalendar=calendar.id;persist();render();
          System.alertBox('iCal','订阅已经保存。\n\n浏览器版不会在后台连接任意 CalDAV 服务器；请使用“文件 → 导入…”导入实际 .ics 内容。');
          return true;
        },
      });
    }

    const unescapeICS=(value)=>String(value||'').replace(/\\n/gi,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\');
    const escapeICS=(value)=>String(value||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
    const parseICSDate=(value)=>{
      const digits=String(value||'').replace(/[^0-9TZ]/g,'');
      if(digits.length<8)return null;
      const date=`${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6,8)}`;
      const time=digits.length>=13?`${digits.slice(9,11)}:${digits.slice(11,13)}`:'09:00';
      return {date,time,allDay:digits.length===8};
    };
    function importICS(){
      System.openPanel({
        parent:win,title:'导入 iCalendar 文件',startPath:'/用户/roll/文稿',types:['ics'],allowUpload:true,
        onOpen:path=>{
          const node=VFS.get(path);
          if(node?.type!=='file'||node.content==null){System.alertBox('iCal','所选文件没有可读取的 iCalendar 文本。');return false;}
          const lines=String(node.content).replace(/\r?\n[ \t]/g,'').split(/\r?\n/);
          const imported=[];let current=null;let inAlarm=false;
          lines.forEach(line=>{
            if(line==='BEGIN:VEVENT'){current={attendees:[],attachments:[],alarm:'none'};return;}
            if(line==='END:VEVENT'){
              if(current){
                const start=parseICSDate(current.dtstart);
                const end=parseICSDate(current.dtend)||start;
                if(start&&current.summary)imported.push(normalizeEvent({
                  id:current.uid||eventId(),title:unescapeICS(current.summary),date:start.date,endDate:end.date,
                  start:start.time,end:end.time,allDay:start.allDay,calendarId:selectedCalendar,
                  location:unescapeICS(current.location),notes:unescapeICS(current.description),
                  repeat:current.repeat||'none',alarm:current.alarm,
                  attendees:current.attendees,attachments:current.attachments,
                },start.date));
              }
              current=null;inAlarm=false;return;
            }
            if(!current)return;
            if(line==='BEGIN:VALARM'){inAlarm=true;return;}
            if(line==='END:VALARM'){inAlarm=false;return;}
            const colon=line.indexOf(':');if(colon<0)return;
            const rawName=line.slice(0,colon),value=line.slice(colon+1);
            const name=rawName.split(';')[0].toUpperCase();
            if(inAlarm&&name==='TRIGGER'){
              current.alarm=value.includes('P1D')?'1d':value.includes('PT1H')?'1h':value.includes('PT5M')?'5m':value.includes('PT15M')?'15m':'at-time';
            }else if(name==='SUMMARY')current.summary=value;
            else if(name==='UID')current.uid=value;
            else if(name==='DTSTART')current.dtstart=value;
            else if(name==='DTEND')current.dtend=value;
            else if(name==='LOCATION')current.location=value;
            else if(name==='DESCRIPTION')current.description=value;
            else if(name==='RRULE'){
              const frequency=(value.match(/FREQ=([A-Z]+)/)||[])[1];
              current.repeat=({DAILY:'daily',WEEKLY:'weekly',MONTHLY:'monthly',YEARLY:'yearly'})[frequency]||'none';
            }else if(name==='ATTENDEE')current.attendees.push(unescapeICS(value.replace(/^mailto:/i,'')));
            else if(name==='ATTACH'&&VFS.get(value))current.attachments.push(value);
          });
          if(!imported.length){System.alertBox('iCal','没有找到可导入的 VEVENT。');return false;}
          imported.forEach(event=>(state.events[event.date]=state.events[event.date]||[]).push(event));
          persist();selectedDate=imported[0].date;render();
          Leopard.toast('iCal',`已导入 ${imported.length} 个事件。`);return true;
        },
      });
    }
    function exportICS(){
      const calendar=calendarFor(selectedCalendar);
      const items=allStoredEvents().filter(({event})=>event.calendarId===selectedCalendar);
      const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
      const icsDate=(date,time,allDay)=>allDay?date.replace(/-/g,''):`${date.replace(/-/g,'')}T${String(time||'09:00').replace(':','')}00`;
      const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Leopard Web//iCal 3//ZH','CALSCALE:GREGORIAN',`X-WR-CALNAME:${escapeICS(calendar?.name||'日历')}`];
      items.forEach(({event,base})=>{
        lines.push('BEGIN:VEVENT',`UID:${event.id}@leopard-web`,`DTSTAMP:${stamp}`);
        lines.push(`${event.allDay?'DTSTART;VALUE=DATE':'DTSTART'}:${icsDate(base,event.start,event.allDay)}`);
        lines.push(`${event.allDay?'DTEND;VALUE=DATE':'DTEND'}:${icsDate(event.endDate||base,event.end,event.allDay)}`);
        lines.push(`SUMMARY:${escapeICS(event.title)}`);
        if(event.location)lines.push(`LOCATION:${escapeICS(event.location)}`);
        if(event.notes)lines.push(`DESCRIPTION:${escapeICS(event.notes)}`);
        if(event.repeat!=='none')lines.push(`RRULE:FREQ=${({daily:'DAILY',weekly:'WEEKLY',monthly:'MONTHLY',yearly:'YEARLY'})[event.repeat]}`);
        event.attendees.forEach(attendee=>lines.push(`ATTENDEE:mailto:${escapeICS(attendee)}`));
        event.attachments.forEach(path=>lines.push(`ATTACH:${escapeICS(path)}`));
        if(event.alarm!=='none'){
          const trigger=({ 'at-time':'PT0M','5m':'-PT5M','15m':'-PT15M','1h':'-PT1H','1d':'-P1D' })[event.alarm]||'-PT15M';
          lines.push('BEGIN:VALARM','ACTION:DISPLAY',`TRIGGER:${trigger}`,`DESCRIPTION:${escapeICS(event.title)}`,'END:VALARM');
        }
        lines.push('END:VEVENT');
      });
      lines.push('END:VCALENDAR','');
      const safeName=(calendar?.name||'日历').replace(/[\\/:*?"<>|]/g,'-');
      System.savePanel({
        parent:win,title:'导出日历',startPath:'/用户/roll/文稿',
        name:VFS.uniqueName('/用户/roll/文稿',safeName,'.ics'),extension:'ics',typeLabel:'iCalendar 文件',allowOverwrite:true,
        onSave:path=>{
          const ok=VFS.putNode(path,{type:'file',kind:'document',mime:'text/calendar',content:lines.join('\r\n'),creator:'ical',generated:true});
          if(ok){System.addRecentDocument?.(path,'ical');Leopard.toast('iCal',`已导出 ${items.length} 个事件。`);}
          return ok;
        },
      });
    }
    function showEventInfo(){
      const stored=selectedStored();
      if(stored){
        const anchor=viewHost.querySelector(`[data-event-id="${CSS.escape(stored.event.id)}"]`);
        if(anchor)showEventPopover(anchor,stored.event.id,selectedOccurrence);
        else openEventEditor(stored,selectedOccurrence);
        return;
      }
      const pane=el('div','ical3-day-summary');
      const items=eventsFor(selectedDate);
      pane.innerHTML=`<header><h3>${escapeHtml(dateLabel(selectedDate))}</h3><span>${items.length} 个事件</span></header><div>${items.map(item=>`<article><i style="--ical-event-color:${escapeHtml(colorForEvent(item.event))}"></i><span><b>${escapeHtml(item.event.title)}</b><small>${item.event.allDay?'全天':`${escapeHtml(item.event.start)}–${escapeHtml(item.event.end)}`} · ${escapeHtml(calendarFor(item.event.calendarId)?.name||'生日')}</small></span></article>`).join('')||'<p>这一天没有事件。</p>'}</div>`;
      System.showSheet({parent:win,title:'事件简介',content:pane,className:'ical3-day-summary-sheet',buttons:[{label:'完成',default:true}]});
    }

    previous.addEventListener('click',()=>{
      const date=dateOf(selectedDate);
      if(view==='month')date.setMonth(date.getMonth()-1);
      else date.setDate(date.getDate()-(view==='week'?7:1));
      selectedDate=keyOf(date);selectedEventId='';persist();render();
    });
    next.addEventListener('click',()=>{
      const date=dateOf(selectedDate);
      if(view==='month')date.setMonth(date.getMonth()+1);
      else date.setDate(date.getDate()+(view==='week'?7:1));
      selectedDate=keyOf(date);selectedEventId='';persist();render();
    });
    today.addEventListener('click',()=>{selectedDate=keyOf(new Date());selectedEventId='';persist();render();});
    viewButtons.addEventListener('click',event=>{
      const button=event.target.closest('[data-view]');if(!button)return;
      view=button.dataset.view;query='';search.value='';persist();render();
    });
    createButton.addEventListener('click',()=>openEventEditor(null,selectedDate));
    headerAction.addEventListener('click',()=>openEventEditor(null,selectedDate));
    todoButton.addEventListener('click',()=>{todoVisible=!todoVisible;persist();render();});
    search.addEventListener('input',()=>{
      clearTimeout(searchTimer);
      searchTimer=setTimeout(()=>{query=search.value.trim();selectedEventId='';renderView();},120);
    });
    search.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&search.value){event.preventDefault();search.value='';query='';renderView();}
    });
    center.addEventListener('pointerdown',event=>{
      if(popover&&!event.target.closest('.ical3-event-popover')&&!event.target.closest('[data-event-id]')){
        selectedEventId='';closePopover();updateWindowState();
      }
    });
    const preferencesChanged=event=>{
      if(event.detail?.appId!=='ical')return;
      preferences=event.detail.preferences||System.getAppPreferences?.('ical')||{};
      render();
    };
    const externalDataChanged=event=>{
      if(event.detail?.source==='ical')return;
      const currentView=view,currentDate=selectedDate,currentTodo=todoVisible;
      state.todos=readMailTodos();
      view=currentView;selectedDate=currentDate;todoVisible=currentTodo;
      persist();render();
    };
    document.addEventListener('app-preferences-changed',preferencesChanged);
    document.addEventListener('mail-data-changed',externalDataChanged);

    win=System.createWindow({
      app:'ical',title:'iCal',width:1020,height:650,toolbar,content:root,statusbar:'正在载入 iCal…',
      onClose:()=>{
        clearTimeout(searchTimer);closePopover();
        document.removeEventListener('app-preferences-changed',preferencesChanged);
        document.removeEventListener('mail-data-changed',externalDataChanged);
        return true;
      },
    });
    win.addEventListener('leopard-command',event=>{
      const actions={
        'new-event':()=>openEventEditor(null,selectedDate),
        'new-calendar':createCalendar,'subscribe-calendar':subscribeCalendar,
        'delete-calendar':removeCalendar,
        'import-ics':importICS,'export-ics':exportICS,
        'today':()=>today.click(),
        'day-view':()=>viewButtons.querySelector('[data-view="day"]').click(),
        'week-view':()=>viewButtons.querySelector('[data-view="week"]').click(),
        'month-view':()=>viewButtons.querySelector('[data-view="month"]').click(),
        'toggle-todos':()=>todoButton.click(),
        'focus-search':()=>{search.focus();search.select();},
        'refresh':()=>{state=loadState();render();Leopard.toast('iCal','所有日历已经刷新。');},
        'event-info':showEventInfo,
        'edit-event':()=>{const stored=selectedStored();if(stored)openEventEditor(stored,selectedOccurrence);},
        'duplicate-event':duplicateEvent,
        'delete-event':()=>{const stored=selectedStored();if(stored)deleteEvent(stored);},
        'attach-event':()=>{const stored=selectedStored();if(stored)openEventEditor(stored,selectedOccurrence);},
        'event-availability':()=>{const stored=selectedStored();if(stored)showAvailability(stored);},
        'new-todo':()=>openTodoEditor(),
      };
      const action=actions[event.detail?.command];
      if(action){event.preventDefault();action();}
    });
    render();
    return win;
  }

  System.registerApp({
    id:'ical',name:'iCal',icon:iCalIcon,open:openICal3,multiWindow:false,
    about:'Leopard iCal 3：日、周、月视图，事件简介和完整编辑，重复与提醒、受邀人可用性、附件、Mail 待办同步以及 iCalendar 导入导出。',
    keywords:'ical calendar 日历 日程 event todo caldav ics 群组日历',
  });
})();
