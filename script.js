/*
 * VODA 방문자 페이지 기능
 *
 * 담당 기능
 * 1. 공통 Header / Footer / 모바일 메뉴
 * 2. Home 공지 목록과 분류
 * 3. Projects 내부 탭
 * 4. Board 고정 공지 / 검색 / 분류 / 페이지 이동 / 상세 조회
 *
 * 다른 파일의 담당 기능
 * - admin.js: 콘텐츠 등록·수정·삭제
 * - content.js: 프로젝트·활동 표시와 사진 슬라이더
 *
 * 현재 게시글은 브라우저 localStorage에서 불러옵니다.
 * 서버 연결 시 readPosts()의 내부를 변경하세요.
 */

(() => {
  "use strict";

  /* ========================================
     1. 공통 설정
     ======================================== */

  // 관리자 코드와 같은 저장 키를 사용해야 합니다.
  const BOARD_STORAGE_KEY = "voda-board-posts-v1";

  // 메뉴를 추가하거나 순서를 바꿀 때 이 배열을 수정하세요.
  const NAV_ITEMS = [
    ["index.html", "Home"],
    ["about.html", "About"],
    ["activities.html", "Activities"],
    ["projects.html", "Projects"],
    ["board.html", "Board"],
    ["apply.html", "Apply"]
  ];

  const CATEGORY_LABELS = {
    notice: "공지",
    activity: "활동",
    recruit: "모집"
  };

  const HOME_POST_LIMIT = 6;
  const BOARD_PAGE_SIZE = 6;

  /* ========================================
     2. 공통 도우미
     ======================================== */

  // 사용자 입력은 innerHTML 대신 textContent로 표시합니다.
  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
  }

  // 저장된 글을 최신 등록 순서로 반환합니다.
  function readPosts() {
    try {
      const stored = localStorage.getItem(BOARD_STORAGE_KEY);
      const posts = JSON.parse(stored || "[]");

      if (!Array.isArray(posts)) return [];

      return posts
        .filter(post =>
          post &&
          typeof post.id === "string" &&
          typeof post.title === "string" &&
          typeof post.content === "string"
        )
        .sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error("게시글을 불러오지 못했습니다.", error);
      return [];
    }
  }

  function categoryLabel(category) {
    return CATEGORY_LABELS[category] || "공지";
  }

  /* ========================================
     3. 공통 Header / Footer
     ======================================== */

  function setupLayout() {
    const header = document.querySelector("#site-header");
    const footer = document.querySelector("#site-footer");

    const currentPage =
      location.pathname.split("/").pop() || "index.html";

    if (header) {
      // 아래 HTML에는 고정된 메뉴·브랜드 정보만 들어갑니다.
      header.innerHTML = `
        <div class="wrap header-inner">
          <a class="logo" href="index.html" aria-label="VODA 홈">
            <img src="images/logo.png" alt="VODA">
          </a>

          <button
            class="menu-button"
            type="button"
            aria-label="메뉴 열기"
            aria-expanded="false"
            aria-controls="site-navigation"
          >☰</button>

          <nav
            id="site-navigation"
            class="nav"
            aria-label="주 메뉴"
          >
            ${NAV_ITEMS.map(([file, label]) => {
              const active = file === currentPage;
              const classes = [
                active ? "active" : "",
                label === "Apply" ? "apply-nav" : ""
              ].filter(Boolean).join(" ");

              return `
                <a
                  href="${file}"
                  class="${classes}"
                  ${active ? 'aria-current="page"' : ""}
                >${label}</a>
              `;
            }).join("")}
          </nav>
        </div>
      `;

      const menuButton = header.querySelector(".menu-button");
      const navigation = header.querySelector(".nav");

      function closeMenu() {
        navigation.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "메뉴 열기");
      }

      menuButton.addEventListener("click", () => {
        const open = navigation.classList.toggle("open");

        menuButton.setAttribute("aria-expanded", String(open));
        menuButton.setAttribute(
          "aria-label",
          open ? "메뉴 닫기" : "메뉴 열기"
        );
      });

      header.addEventListener("keydown", event => {
        if (
          event.key === "Escape" &&
          navigation.classList.contains("open")
        ) {
          closeMenu();
          menuButton.focus();
        }
      });

      // 모바일 메뉴를 연 뒤 PC 크기로 바꾸면 상태를 초기화합니다.
      window.matchMedia("(max-width: 650px)")
        .addEventListener("change", closeMenu);
    }

    if (footer) {
      footer.innerHTML = `
        <div class="wrap footer-inner">
          <a class="logo" href="index.html" aria-label="VODA 홈">
            <img src="images/logo.png" alt="VODA">
          </a>
          <span>Value-Oriented Data Analysis</span>
        </div>
      `;
    }
  }

  /* ========================================
     4. Home 공지 목록
     ======================================== */

  function setupHome() {
    const root = document.querySelector("#home-notices");
    const list = document.querySelector("#home-posts");

    if (!root || !list) return;

    const buttons = root.querySelectorAll("[data-category]");
    let selectedCategory = "all";

    function render() {
      const posts = readPosts().filter(post =>
        selectedCategory === "all" ||
        post.category === selectedCategory
      );

      list.replaceChildren();

      if (posts.length === 0) {
        list.append(
          createElement("li", "empty", "등록된 게시글이 없습니다.")
        );
        return;
      }

      posts.slice(0, HOME_POST_LIMIT).forEach(post => {
        const row = createElement("li", "post-row");

        const link = createElement(
          "a",
          "post-title",
          `[${categoryLabel(post.category)}] ${post.title}`
        );

        link.href = `board.html?id=${encodeURIComponent(post.id)}`;

        const date = createElement("time", "post-date", post.date);

        row.append(link, date);
        list.append(row);
      });
    }

    buttons.forEach(button => {
      // 분류 버튼은 탭이 아니라 선택 버튼으로 처리합니다.
      button.removeAttribute("aria-selected");

      button.setAttribute(
        "aria-pressed",
        String(button.dataset.category === selectedCategory)
      );

      button.addEventListener("click", () => {
        selectedCategory = button.dataset.category;

        buttons.forEach(otherButton => {
          const selected = otherButton === button;

          otherButton.classList.toggle("active", selected);
          otherButton.setAttribute("aria-pressed", String(selected));
        });

        render();
      });
    });

    render();

    // 다른 탭의 관리자 화면에서 게시글을 변경하면 갱신합니다.
    window.addEventListener("storage", event => {
      if (event.key === BOARD_STORAGE_KEY || event.key === null) {
        render();
      }
    });
  }

  /* ========================================
     5. Projects 내부 탭
     ======================================== */

  function setupProjectTabs() {
    const buttons = document.querySelectorAll("[data-project-tab]");
    const panels = document.querySelectorAll("[data-project-panel]");

    if (buttons.length === 0) return;

    function selectTab(selectedButton) {
      buttons.forEach(button => {
        const selected = button === selectedButton;

        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });

      panels.forEach(panel => {
        panel.hidden =
          panel.dataset.projectPanel !==
          selectedButton.dataset.projectTab;
      });
    }

    buttons.forEach(button => {
      button.addEventListener("click", () => selectTab(button));
    });

    selectTab(
      Array.from(buttons).find(button =>
        button.classList.contains("active")
      ) || buttons[0]
    );
  }

  /* ========================================
     6. Board 조회 기능
     ======================================== */

  function setupBoard() {
    const listView = document.querySelector("#voda-board-list");

    if (!listView) return;

    const pinnedArea = document.querySelector("#voda-board-pinned");
    const list = document.querySelector("#voda-board-posts");
    const pagination = document.querySelector("#voda-board-pagination");
    const searchForm = document.querySelector("#voda-board-search");
    const filters = document.querySelectorAll("[data-board-category]");
    const detailView = document.querySelector("#voda-board-detail");
    const backButton = document.querySelector("#voda-board-back");

    let posts = readPosts();
    let selectedCategory = "all";
    let keyword = "";
    let currentPage = 1;

    // Board 목록과 고정 공지는 같은 상세 주소를 사용합니다.
    function detailURL(id) {
      const url = new URL(location.href);

      url.searchParams.delete("id");
      url.hash = `post=${encodeURIComponent(id)}`;

      return url.href;
    }

    /* 고정 공지: 최신 등록 순서로 두 개 표시 */
    function renderPinned() {
      pinnedArea.replaceChildren();

      const pinnedPosts = posts
        .filter(post => post.pinned)
        .slice(0, 2);

      for (let index = 0; index < 2; index++) {
        const post = pinnedPosts[index];

        if (!post) {
          const placeholder = createElement(
            "div",
            "board-pin board-pin-placeholder"
          );

          placeholder.append(
            createElement("span", "board-pin-label", "고정 공지"),
            createElement(
              "span",
              "board-pin-title",
              "고정 공지가 들어갈 자리"
            )
          );

          pinnedArea.append(placeholder);
          continue;
        }

        const link = createElement("a", "board-pin");
        link.href = detailURL(post.id);

        link.append(
          createElement("span", "board-pin-label", "고정 공지"),
          createElement("span", "board-pin-title", post.title),
          createElement("span", "board-pin-date", post.date)
        );

        pinnedArea.append(link);
      }
    }

    /* 분류·검색 결과와 페이지 버튼 표시 */
    function renderList() {
      const filtered = posts.filter(post => {
        const categoryMatches =
          selectedCategory === "all" ||
          post.category === selectedCategory;

        const titleMatches = post.title
          .toLocaleLowerCase()
          .includes(keyword.toLocaleLowerCase());

        return categoryMatches && titleMatches;
      });

      const pageCount = Math.max(
        1,
        Math.ceil(filtered.length / BOARD_PAGE_SIZE)
      );

      currentPage = Math.min(currentPage, pageCount);

      const visible = filtered.slice(
        (currentPage - 1) * BOARD_PAGE_SIZE,
        currentPage * BOARD_PAGE_SIZE
      );

      list.replaceChildren();

      if (visible.length === 0) {
        list.append(
          createElement(
            "li",
            "board-empty",
            keyword
              ? "검색 결과가 없습니다."
              : "등록된 게시글이 없습니다."
          )
        );
      }

      visible.forEach(post => {
        const row = createElement("li", "board-post-item");

        const label = createElement(
          "span",
          "board-post-category",
          categoryLabel(post.category)
        );

        const link = createElement(
          "a",
          "board-post-link",
          post.title
        );

        link.href = detailURL(post.id);

        row.append(
          label,
          link,
          createElement("time", "", post.date)
        );

        list.append(row);
      });

      pagination.replaceChildren();

      for (let number = 1; number <= pageCount; number++) {
        const button = createElement("button", "", String(number));

        button.type = "button";
        button.classList.toggle("active", number === currentPage);
        button.setAttribute("aria-label", `${number}페이지`);

        if (number === currentPage) {
          button.setAttribute("aria-current", "page");
        }

        button.addEventListener("click", () => {
          currentPage = number;
          renderList();
        });

        pagination.append(button);
      }
    }

    /* URL에 게시글 ID가 있으면 상세 화면 표시 */
    function renderDetail() {
      const hash = new URLSearchParams(location.hash.slice(1));
      const query = new URLSearchParams(location.search);
      const id = hash.get("post") || query.get("id");

      listView.hidden = Boolean(id);
      detailView.hidden = !id;

      if (!id) return;

      const post = posts.find(item => item.id === id);

      detailView.querySelector("h2").textContent =
        post ? post.title : "게시글을 찾을 수 없습니다.";

      detailView.querySelector(".board-detail-meta").textContent =
        post
          ? `${categoryLabel(post.category)} · ${post.date}`
          : "";

      detailView.querySelector(".board-detail-body").textContent =
        post ? post.content : "";
    }

    filters.forEach(button => {
      button.addEventListener("click", () => {
        selectedCategory = button.dataset.boardCategory;
        currentPage = 1;

        filters.forEach(otherButton => {
          const selected = otherButton === button;

          otherButton.classList.toggle("active", selected);
          otherButton.setAttribute("aria-pressed", String(selected));
        });

        renderList();
      });
    });

    searchForm.addEventListener("submit", event => {
      event.preventDefault();

      keyword = searchForm.elements.keyword.value.trim();
      currentPage = 1;

      renderList();
    });

    backButton.addEventListener("click", () => {
      const url = new URL(location.href);

      url.searchParams.delete("id");
      url.hash = "";

      history.pushState(null, "", url);
      renderDetail();
    });

    window.addEventListener("hashchange", renderDetail);
    window.addEventListener("popstate", renderDetail);

    // 관리자와 Board를 서로 다른 브라우저 탭에 열었을 때 갱신
    window.addEventListener("storage", event => {
      if (event.key === BOARD_STORAGE_KEY || event.key === null) {
        posts = readPosts();

        renderPinned();
        renderList();
        renderDetail();
      }
    });

    renderPinned();
    renderList();
    renderDetail();
  }

  /* ========================================
     7. 페이지별 기능 실행
     해당 요소가 없는 페이지에서는 실행하지 않습니다.
     ======================================== */

  setupLayout();
  setupHome();
  setupProjectTabs();
  setupBoard();
})();