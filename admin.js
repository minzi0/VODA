(() => {
  "use strict";

  /* ==================================================
     01. 저장소와 기본 설정
     방문자용 script.js·content.js와 같은 이름을 사용합니다.
     이름을 바꾸면 기존 데이터가 보이지 않을 수 있습니다.
  ================================================== */

  const BOARD_KEY = "voda-board-posts-v1";
  const DATABASE_NAME = "voda-content-v1";
  const DATABASE_VERSION = 1;

  const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
  const ALLOWED_PHOTO_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  const TAB_NAMES = {
    board: "Board",
    projects: "Projects",
    activities: "Activities"
  };

  /* ==================================================
     02. HTML 요소와 현재 편집 상태
  ================================================== */

  const form = document.querySelector("#editor-form");
  const list = document.querySelector("#admin-list");
  const imageInput = document.querySelector("#image-input");
  const preview = document.querySelector("#image-preview");
  const message = document.querySelector("#admin-message");

  const saveButton = document.querySelector("#save-button");
  const deleteButton = document.querySelector("#delete-button");
  const newButton = document.querySelector("#new-button");
  const tabButtons = [...document.querySelectorAll("[data-tab]")];

  const listHeading = document.querySelector("#list-heading");
  const editorHeading = document.querySelector("#editor-heading");

  const fields = {
    title: form.elements.namedItem("title"),
    body: form.elements.namedItem("body"),
    category: form.elements.namedItem("category"),
    pinned: form.elements.namedItem("pinned"),
    projectCategory: form.elements.namedItem("projectCategory"),
    link: form.elements.namedItem("link")
  };

  // 탭마다 표시할 입력 영역
  const conditionalFields = [
    { id: "category-field", tabs: ["board"] },
    { id: "pinned-field", tabs: ["board"] },
    { id: "project-category-field", tabs: ["projects"] },
    { id: "link-field", tabs: ["projects"] },
    { id: "image-field", tabs: ["projects", "activities"] }
  ];

  let currentTab = "board";
  let selectedId = null;
  let items = [];
  let photos = [];

  let previewURLs = [];
  let databasePromise = null;

  let busy = false;
  let ready = false;
  let dirty = false;

  /* ==================================================
     03. 저장소 읽기·쓰기
     Board: localStorage
     Projects / Activities: IndexedDB
  ================================================== */

  // 사진 저장소는 필요한 탭을 열 때 연결합니다.
  function openDatabase() {
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(
        DATABASE_NAME,
        DATABASE_VERSION
      );

      request.onupgradeneeded = () => {
        const database = request.result;

        for (const name of ["projects", "activities"]) {
          if (!database.objectStoreNames.contains(name)) {
            database.createObjectStore(name, { keyPath: "id" });
          }
        }
      };

      request.onsuccess = () => {
        const database = request.result;

        database.onversionchange = () => {
          database.close();
          databasePromise = null;
        };

        resolve(database);
      };

      request.onerror = () => {
        databasePromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        setMessage(
          "저장소 연결이 대기 중입니다. 다른 VODA 탭을 닫고 다시 확인해주세요.",
          true
        );
      };
    });

    return databasePromise;
  }

  async function databaseAction(storeName, mode, operation) {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(
        transaction.objectStore(storeName)
      );

      // 요청뿐 아니라 전체 저장 작업이 완료된 뒤 성공으로 처리합니다.
      transaction.oncomplete = () => resolve(request.result);

      transaction.onerror = () => {
        reject(transaction.error || request.error);
      };

      transaction.onabort = () => {
        reject(
          transaction.error ||
          request.error ||
          new Error("저장소 작업이 중단되었습니다.")
        );
      };
    });
  }

  function validateItems(value) {
    const valid = Array.isArray(value) && value.every(item =>
      item &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      typeof item.title === "string"
    );

    if (!valid) {
      throw new Error("저장 데이터 형식이 올바르지 않습니다.");
    }

    return value;
  }

  function readBoard() {
    const value = JSON.parse(
      localStorage.getItem(BOARD_KEY) || "[]"
    );

    return validateItems(value);
  }

  function writeBoard(posts) {
    localStorage.setItem(BOARD_KEY, JSON.stringify(posts));
  }

  function sortItems(value) {
    return [...value].sort(
      (a, b) => (Number(b.createdAt) || 0) -
                (Number(a.createdAt) || 0)
    );
  }

  async function readItems(tab) {
    const value = tab === "board"
      ? readBoard()
      : await databaseAction(
          tab,
          "readonly",
          store => store.getAll()
        );

    return sortItems(validateItems(value));
  }

  /* ==================================================
     04. 공통 화면 처리와 변경사항 확인
  ================================================== */

  function makeElement(tag, className = "", text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
  }

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
    message.setAttribute("role", isError ? "alert" : "status");
  }

  function errorText(error) {
    return error?.message || "알 수 없는 오류가 발생했습니다.";
  }

  function markDirty() {
    if (busy || !ready) return;

    dirty = true;
    setMessage("변경사항이 있습니다. 저장 버튼을 눌러주세요.");
  }

  function canLeaveEditor() {
    if (!dirty) return true;

    return window.confirm(
      "저장하지 않은 변경사항이 있습니다. 저장하지 않고 이동할까요?"
    );
  }

  // 숨긴 영역의 입력칸도 비활성화합니다.
  // 예: Activities에서는 프로젝트 URL의 유효성 검사를 하지 않습니다.
  function updateControls() {
    const editorDisabled = busy || !ready;

    for (const control of form.querySelectorAll(
      "input, select, textarea, button"
    )) {
      control.disabled = editorDisabled;
    }

    for (const field of conditionalFields) {
      const container = document.getElementById(field.id);
      const visible = field.tabs.includes(currentTab);

      container.hidden = !visible;

      for (const control of container.querySelectorAll(
        "input, select, textarea, button"
      )) {
        control.disabled = editorDisabled || !visible;
      }
    }

    // 사진의 처음과 끝에서는 이동할 수 없는 방향을 비활성화합니다.
    for (const button of preview.querySelectorAll("button")) {
      button.disabled =
        editorDisabled || button.dataset.unavailable === "true";
    }

    for (const button of list.querySelectorAll("button")) {
      button.disabled = busy || !ready;
    }

    newButton.disabled = editorDisabled;
    deleteButton.disabled = editorDisabled || !selectedId;

    // 처음 목록을 불러오는 데 실패해도 다른 탭으로 이동할 수 있습니다.
    tabButtons.forEach(button => {
      button.disabled = busy;
    });

    form.setAttribute("aria-busy", String(busy));
    list.setAttribute("aria-busy", String(busy));
  }

  function setBusy(value) {
    busy = value;
    updateControls();
  }

  /* ==================================================
     05. 왼쪽 항목 목록
  ================================================== */

  function renderList() {
    list.replaceChildren();

    if (items.length === 0) {
      list.append(
        makeElement("li", "list-empty", "등록된 항목이 없습니다.")
      );
      return;
    }

    for (const item of items) {
      const li = document.createElement("li");
      
      // 고정 게시글 표시
      const title = currentTab === "board" && item.pinned
       ? `[고정] ${item.title}`
        : item.title;

      const button = makeElement("button", "", title);

      button.type = "button";
      button.classList.toggle("active", item.id === selectedId);
      button.setAttribute(
        "aria-pressed",
        String(item.id === selectedId)
      );

      button.addEventListener("click", () => {
        if (busy || !ready || item.id === selectedId) return;
        if (!canLeaveEditor()) return;

        editItem(item);
      });

      li.append(button);
      list.append(li);
    }

    updateControls();
  }

  /* ==================================================
     06. 사진 미리보기·삭제·순서 변경
  ================================================== */

  function releasePreviewURLs() {
    previewURLs.forEach(url => URL.revokeObjectURL(url));
    previewURLs = [];
  }

  function movePhoto(index, direction) {
    if (busy || !ready) return;

    const target = index + direction;
    if (target < 0 || target >= photos.length) return;

    [photos[index], photos[target]] =
      [photos[target], photos[index]];

    markDirty();
    renderPhotos();
  }

  function renderPhotos() {
    releasePreviewURLs();
    preview.replaceChildren();

    photos.forEach((photo, index) => {
      const card = makeElement("div", "image-card");
      const img = document.createElement("img");
      const url = URL.createObjectURL(photo.blob);

      previewURLs.push(url);
      img.src = url;
      img.alt = `선택한 사진 ${index + 1}`;

      const caption = makeElement(
        "p",
        "",
        `${index + 1}. ${photo.name}`
      );

      const controls = makeElement("div", "image-controls");
      const previous = makeElement("button", "", "←");
      const next = makeElement("button", "", "→");
      const remove = makeElement("button", "", "삭제");

      previous.type = next.type = remove.type = "button";

      previous.setAttribute("aria-label", "사진 앞으로 이동");
      next.setAttribute("aria-label", "사진 뒤로 이동");
      remove.setAttribute(
        "aria-label",
        `${index + 1}번 사진 삭제`
      );

      previous.dataset.unavailable = String(index === 0);
      next.dataset.unavailable = String(
        index === photos.length - 1
      );

      previous.addEventListener("click", () => movePhoto(index, -1));
      next.addEventListener("click", () => movePhoto(index, 1));

      remove.addEventListener("click", () => {
        if (busy || !ready) return;

        photos.splice(index, 1);
        markDirty();
        renderPhotos();
      });

      controls.append(previous, next, remove);
      card.append(img, caption, controls);
      preview.append(card);
    });

    updateControls();
  }

  /* ==================================================
     07. 새 항목 작성·기존 항목 편집
  ================================================== */

  function resetEditor() {
    selectedId = null;
    photos = [];
    dirty = false;

    form.reset();
    editorHeading.textContent = "새 항목 등록";
    saveButton.textContent = "등록";
    deleteButton.hidden = true;

    setMessage("");
    renderPhotos();
    renderList();
    updateControls();
  }

  function editItem(item) {
    selectedId = item.id;
    form.reset();

    fields.title.value = item.title;
    fields.body.value = currentTab === "board"
      ? item.content || ""
      : item.description || "";

    fields.category.value = item.category || "notice";
    fields.pinned.checked = Boolean(item.pinned);
    fields.projectCategory.value = item.projectCategory || "";
    fields.link.value = item.link || "";

    photos = (item.photos || [])
      .filter(photo => photo?.blob instanceof Blob)
      .map(photo => ({ ...photo }));

    dirty = false;
    editorHeading.textContent = "항목 수정";
    saveButton.textContent = "수정 저장";
    deleteButton.hidden = false;

    setMessage("");
    renderPhotos();
    renderList();
    updateControls();
  }

  /* ==================================================
     08. 관리 탭 전환
     목록을 읽는 데 성공한 뒤 실제 탭을 변경합니다.
     실패하면 기존 탭과 입력 내용을 유지합니다.
  ================================================== */

  function updateTabDisplay() {
    tabButtons.forEach(button => {
      const selected = button.dataset.tab === currentTab;

      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    listHeading.textContent = `${TAB_NAMES[currentTab]} 목록`;

    document.querySelector("#body-label").textContent =
      currentTab === "board" ? "본문" : "설명";

    imageInput.multiple = currentTab === "activities";

    document.querySelector("#image-help").textContent =
      currentTab === "projects"
        ? "대표 이미지 한 장을 선택하세요. 사진 한 장당 최대 5MB입니다."
        : "사진을 여러 장 선택할 수 있습니다. 화살표로 순서를 바꾸세요. 사진 한 장당 최대 5MB입니다.";

    updateControls();
  }

  async function switchTab(tab) {
    if (busy || !Object.hasOwn(TAB_NAMES, tab)) return;
    if (ready && tab === currentTab) return;
    if (!canLeaveEditor()) return;

    setBusy(true);

    try {
      // 실패할 수 있는 작업을 먼저 수행합니다.
      const nextItems = await readItems(tab);

      currentTab = tab;
      items = nextItems;
      ready = true;

      updateTabDisplay();
      resetEditor();
    } catch (error) {
      setMessage(
        `목록을 불러오지 못했습니다: ${errorText(error)}`,
        true
      );
    } finally {
      setBusy(false);
    }
  }

  /* ==================================================
     09. 사진 파일 선택
     Projects는 한 장, Activities는 여러 장을 사용합니다.
  ================================================== */

  function handlePhotoSelection() {
    if (busy || !ready || currentTab === "board") return;

    const files = [...imageInput.files];
    imageInput.value = "";

    if (files.length === 0) return;

    const invalid = files.some(file =>
      !ALLOWED_PHOTO_TYPES.includes(file.type) ||
      file.size > MAX_PHOTO_SIZE
    );

    if (invalid) {
      setMessage(
        "JPG·PNG·WebP 형식의 5MB 이하 사진을 선택해주세요.",
        true
      );
      return;
    }

    const selectedPhotos = files.map(file => ({
      name: file.name,
      blob: file
    }));

    if (currentTab === "projects") {
      photos = selectedPhotos.slice(0, 1);
    } else {
      photos.push(...selectedPhotos);
    }

    markDirty();
    renderPhotos();
  }

  /* ==================================================
     10. 등록·수정 저장
  ================================================== */

  function dateLabel(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join(".");
  }

  function buildItem() {
    const title = fields.title.value.trim();
    const body = fields.body.value.trim();

    if (!title || !body) {
      throw new Error("제목과 내용을 입력해주세요.");
    }

    const link = fields.link.value.trim();

    if (currentTab === "projects" && link) {
      let validLink = false;

      try {
        const url = new URL(link);
        validLink = ["https:", "http:"].includes(url.protocol);
      } catch {
        validLink = false;
      }

      if (!validLink) {
        throw new Error(
          "프로젝트 링크는 http 또는 https 주소로 입력해주세요."
        );
      }
    }

    const now = new Date();
    const existing = items.find(item => item.id === selectedId);

    const item = {
      id: selectedId || crypto.randomUUID(),
      title,
      createdAt: existing?.createdAt ?? now.getTime(),
      updatedAt: now.getTime()
    };

    if (currentTab === "board") {
      item.content = body;
      item.category = fields.category.value;
      item.pinned = fields.pinned.checked;
      item.date = existing?.date || dateLabel(now);
    } else {
      item.description = body;
      item.photos = photos.map(photo => ({ ...photo }));

      if (currentTab === "projects") {
        item.projectCategory = fields.projectCategory.value.trim();
        item.link = link;
      }
    }

    return item;
  }

  async function saveItem(event) {
    event.preventDefault();
    if (busy || !ready) return;

    let item;

    try {
      item = buildItem();
    } catch (error) {
      setMessage(errorText(error), true);
      return;
    }

    setBusy(true);

    try {
      let nextItems;

      if (currentTab === "board") {
        // 다른 탭에서 추가한 글을 덮어쓰지 않도록 최신 목록을 읽습니다.
        const board = readBoard();
        const index = board.findIndex(post => post.id === item.id);

        if (index >= 0) {
          board[index] = item;
        } else {
          board.unshift(item);
        }

        writeBoard(board);
        nextItems = board;
      } else {
        await databaseAction(
          currentTab,
          "readwrite",
          store => store.put(item)
        );

        nextItems = [
          ...items.filter(saved => saved.id !== item.id),
          item
        ];
      }

      // 저장 성공 후 별도 재조회 실패가 저장 실패로 표시되지 않게 합니다.
      items = sortItems(nextItems);
      editItem(item);
      setMessage("저장했습니다.");
    } catch (error) {
      setMessage(
        `저장하지 못했습니다. 입력 내용은 유지됩니다. ${errorText(error)}`,
        true
      );
    } finally {
      setBusy(false);
    }
  }

  /* ==================================================
     11. 항목 삭제
  ================================================== */

  async function deleteItem() {
    if (busy || !ready || !selectedId) return;

    const prompt = dirty
      ? "저장하지 않은 변경사항이 있습니다. 변경사항과 선택한 항목을 삭제할까요?"
      : "선택한 항목을 삭제할까요?";

    if (!window.confirm(prompt)) return;

    setBusy(true);

    try {
      let nextItems;

      if (currentTab === "board") {
        nextItems = readBoard().filter(
          post => post.id !== selectedId
        );

        writeBoard(nextItems);
      } else {
        await databaseAction(
          currentTab,
          "readwrite",
          store => store.delete(selectedId)
        );

        nextItems = items.filter(item => item.id !== selectedId);
      }

      items = sortItems(nextItems);
      resetEditor();
      setMessage("삭제했습니다.");
    } catch (error) {
      setMessage(
        `삭제하지 못했습니다: ${errorText(error)}`,
        true
      );
    } finally {
      setBusy(false);
    }
  }

  /* ==================================================
     12. 이벤트 연결과 초기 실행
  ================================================== */

  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      switchTab(button.dataset.tab);
    });
  });

  newButton.addEventListener("click", () => {
    if (busy || !ready || !canLeaveEditor()) return;
    resetEditor();
  });

  // 글자 입력과 체크박스·분류 선택을 변경사항으로 인식합니다.
  form.addEventListener("input", event => {
    if (event.target === imageInput) return;
    markDirty();
  });

  form.addEventListener("change", event => {
    if (event.target === imageInput) return;
    markDirty();
  });

  imageInput.addEventListener("change", handlePhotoSelection);
  form.addEventListener("submit", saveItem);
  deleteButton.addEventListener("click", deleteItem);

  // 새로고침·탭 닫기·다른 페이지 이동 시 브라우저 기본 확인창
  window.addEventListener("beforeunload", event => {
    if (!dirty && !busy) return;

    event.preventDefault();
    event.returnValue = "";
  });

  // 뒤로가기로 복원될 화면에서는 미리보기 주소를 유지합니다.
  window.addEventListener("pagehide", event => {
    if (!event.persisted) releasePreviewURLs();
  });

  updateTabDisplay();
  switchTab("board");
})();