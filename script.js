const NAV = [
  ["index.html", "Home"],
  ["about.html", "About"],
  ["activities.html", "Activities"],
  ["projects.html", "Projects"],
  ["board.html", "Board"],
  ["apply.html", "Apply"]
];

const currentPage =
  location.pathname.split("/").pop() || "index.html";

document.querySelector("#site-header").innerHTML = `
  <div class="wrap header-inner">
    <a class="logo" href="index.html" aria-label="VODA 홈">
      <img src="images/logo.png" alt="VODA">
    </a>

    <button
      class="menu-button"
      type="button"
      aria-label="메뉴 열기"
      aria-expanded="false"
    >☰</button>

    <nav class="nav" aria-label="주 메뉴">
      ${NAV.map(([file, label]) => `
        <a
          href="${file}"
          class="${file === currentPage ? "active " : ""}${label === "Apply" ? "apply-nav" : ""}"
          ${file === currentPage ? 'aria-current="page"' : ""}
        >${label}</a>
      `).join("")}
    </nav>
  </div>
`;

document.querySelector("#site-footer").innerHTML = `
  <div class="wrap footer-inner">
    <a class="logo" href="index.html">
      <img src="images/logo.png" alt="VODA">
    </a>
    <span>Value-Oriented Data Analysis</span>
  </div>
`;

const menuButton = document.querySelector(".menu-button");
const navigation = document.querySelector(".nav");

menuButton.addEventListener("click", () => {
  const isOpen = navigation.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
});

/*
  프론트 시연용 저장:
  게시글은 이 브라우저의 localStorage에만 저장됩니다.
  나중에 서버 API가 생기면 loadPosts와 savePosts를 교체하면 됩니다.
*/
const STORAGE_KEY = "voda-board-posts-v1";

function loadPosts() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function savePosts(posts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

const categoryNames = {
  notice: "공지",
  activity: "활동",
  recruit: "모집"
};

function makePostRow(post) {
  const item = document.createElement("li");
  item.className = "post-row";

  const icon = document.createElement("span");
  icon.className = "post-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "◀";

  const link = document.createElement("a");
  link.className = "post-title";
  link.href = `board.html?id=${encodeURIComponent(post.id)}`;
  link.textContent =
    `[${categoryNames[post.category] || "공지"}] ${post.title}`;

  const date = document.createElement("time");
  date.className = "post-date";
  date.textContent = post.date;

  item.append(icon, link, date);
  return item;
}

function renderList(element, posts, limit) {
  element.replaceChildren();

  const selected =
    typeof limit === "number" ? posts.slice(0, limit) : posts;

  if (selected.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty";
    emptyItem.textContent = "등록된 게시글이 없습니다.";
    element.append(emptyItem);
    return;
  }

  selected.forEach(post => {
    element.append(makePostRow(post));
  });
}

function setupTabs(root, list, posts, limit) {
  let selectedCategory = "all";
  const buttons = root.querySelectorAll("[data-category]");

  function update() {
    const visiblePosts =
      selectedCategory === "all"
        ? posts
        : posts.filter(post => post.category === selectedCategory);

    renderList(list, visiblePosts, limit);
  }

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category;

      buttons.forEach(otherButton => {
        const isActive = otherButton === button;
        otherButton.classList.toggle("active", isActive);
        otherButton.setAttribute("aria-selected", String(isActive));
      });

      update();
    });
  });

  update();
}

const posts = loadPosts().sort(
  (first, second) => second.createdAt - first.createdAt
);

/* Home의 최신 게시글 */

const homeList = document.querySelector("#home-posts");

if (homeList) {
  setupTabs(
    document.querySelector("#home-notices"),
    homeList,
    posts,
    6
  );
}

/* Board의 전체 게시글 */

const boardList = document.querySelector("#board-posts");

if (boardList) {
  setupTabs(
    document.querySelector("#board-list-panel"),
    boardList,
    posts
  );
}

/* Board에서 글 작성 */

const postForm = document.querySelector("#post-form");

if (postForm) {
  postForm.addEventListener("submit", event => {
    event.preventDefault();

    const data = new FormData(postForm);
    const title = String(data.get("title") || "").trim();
    const content = String(data.get("content") || "").trim();
    const category = String(data.get("category") || "notice");

    if (!title || !content || !categoryNames[category]) {
      return;
    }

    const now = new Date();
    const date = new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
      .format(now)
      .replace(/\. /g, ".")
      .replace(/\.$/, "");

    posts.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      content,
      category,
      date,
      createdAt: now.getTime()
    });

    savePosts(posts);
    location.href = "board.html";
  });
}

/* Board에서 게시글 상세 보기 */

const postDetail = document.querySelector("#post-detail");

if (postDetail) {
  const id = new URLSearchParams(location.search).get("id");
  const post = posts.find(item => item.id === id);

  if (post) {
    document.querySelector("#board-list-view").hidden = true;
    postDetail.hidden = false;

    postDetail.querySelector("h2").textContent = post.title;
    postDetail.querySelector(".post-meta").textContent =
      `${categoryNames[post.category]} · ${post.date}`;
    postDetail.querySelector(".post-body").textContent = post.content;
  }
}

/* Projects의 두 탭 */

const projectTabs =
  document.querySelectorAll("[data-project-tab]");

projectTabs.forEach(button => {
  button.addEventListener("click", () => {
    projectTabs.forEach(otherButton => {
      otherButton.classList.toggle(
        "active",
        otherButton === button
      );
    });

    document
      .querySelectorAll("[data-project-panel]")
      .forEach(panel => {
        panel.hidden =
          panel.dataset.projectPanel !== button.dataset.projectTab;
      });
  });
});

/* =========================
   Activities 사진 슬라이더
   ========================= */

document.querySelectorAll(".activity-slider").forEach((slider) => {
  const slides = Array.from(
    slider.querySelectorAll(".activity-slide")
  );

  const previousButton = slider.querySelector(".activity-prev");
  const nextButton = slider.querySelector(".activity-next");
  const dotsContainer = slider.querySelector(".activity-dots");
  const status = slider.querySelector(".activity-status");
  const photoArea = slider.querySelector(".activity-slides");

  if (slides.length === 0) return;

  let currentIndex = 0;

  /* 사진 수에 맞춰 아래 점 버튼 생성 */
  dotsContainer.replaceChildren();

  const dots = slides.map((slide, index) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "activity-dot";
    button.setAttribute(
      "aria-label",
      `${index + 1}번째 사진 보기`
    );

    button.addEventListener("click", () => {
      showSlide(index);
    });

    dotsContainer.appendChild(button);

    return button;
  });

  /* 선택한 사진 표시 */
  function showSlide(index) {
    currentIndex =
      (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
      slide.hidden = slideIndex !== currentIndex;
    });

    dots.forEach((dot, dotIndex) => {
      const isCurrent = dotIndex === currentIndex;

      dot.classList.toggle("active", isCurrent);

      if (isCurrent) {
        dot.setAttribute("aria-current", "true");
      } else {
        dot.removeAttribute("aria-current");
      }
    });

    status.textContent =
      `전체 ${slides.length}장 중 ${currentIndex + 1}번째 사진`;
  }

  previousButton.addEventListener("click", () => {
    showSlide(currentIndex - 1);
  });

  nextButton.addEventListener("click", () => {
    showSlide(currentIndex + 1);
  });

  /* 버튼에 초점이 있을 때 키보드 좌우 방향키 지원 */
  slider.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showSlide(currentIndex - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      showSlide(currentIndex + 1);
    }
  });

  /* 모바일에서 손가락으로 넘기기 */
  let touchStartX = null;
  let touchStartY = null;

  photoArea.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) {
      touchStartX = null;
      touchStartY = null;
      return;
    }

    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  photoArea.addEventListener("touchend", (event) => {
    if (touchStartX === null || touchStartY === null) return;

    const touch = event.changedTouches[0];
    const distanceX = touch.clientX - touchStartX;
    const distanceY = touch.clientY - touchStartY;

    /*
      가로로 50px 이상 밀었고,
      세로 움직임보다 가로 움직임이 클 때만 넘김
    */
    if (
      Math.abs(distanceX) > 50 &&
      Math.abs(distanceX) > Math.abs(distanceY)
    ) {
      if (distanceX < 0) {
        showSlide(currentIndex + 1);
      } else {
        showSlide(currentIndex - 1);
      }
    }

    touchStartX = null;
    touchStartY = null;
  }, { passive: true });

  photoArea.addEventListener("touchcancel", () => {
    touchStartX = null;
    touchStartY = null;
  }, { passive: true });

  /* 사진이 한 장이면 넘기기 버튼과 점 숨기기 */
  if (slides.length === 1) {
    previousButton.hidden = true;
    nextButton.hidden = true;
    dotsContainer.hidden = true;
  }

  showSlide(0);
});

/* =========================
   Board — B안
   ========================= */

(() => {
  const listView = document.querySelector("#voda-board-list");

  // Board 이외 페이지에서는 실행하지 않음
  if (!listView) return;

  const pinnedArea = document.querySelector("#voda-board-pinned");
  const list = document.querySelector("#voda-board-posts");
  const pagination = document.querySelector("#voda-board-pagination");
  const searchForm = document.querySelector("#voda-board-search");
  const filters = document.querySelectorAll("[data-board-category]");

  const detailView = document.querySelector("#voda-board-detail");
  const dialog = document.querySelector("#voda-board-dialog");
  const writeForm = document.querySelector("#voda-board-form");
  const error = document.querySelector("#voda-board-error");

  const names = {
    notice: "공지",
    activity: "활동",
    recruit: "모집"
  };

  const pageSize = 6;

  let boardPosts = loadPosts().sort(
    (a, b) => b.createdAt - a.createdAt
  );

  let category = "all";
  let keyword = "";
  let page = 1;

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
  }

  /* 고정 공지 두 자리 */
  function renderPinned() {
    pinnedArea.replaceChildren();

    const pinnedPosts = boardPosts
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

      const button = createElement("button", "board-pin");
      button.type = "button";

      button.append(
        createElement("span", "board-pin-label", "고정 공지"),
        createElement("span", "board-pin-title", post.title),
        createElement("span", "board-pin-date", post.date)
      );

      button.addEventListener("click", () => {
        location.hash = `post=${encodeURIComponent(post.id)}`;
      });

      pinnedArea.append(button);
    }
  }

  /* 게시글 목록 */
  function renderBoard() {
    renderPinned();

    const filtered = boardPosts.filter(post => {
      const categoryMatches =
        category === "all" || post.category === category;

      const titleMatches = String(post.title)
        .toLocaleLowerCase()
        .includes(keyword.toLocaleLowerCase());

      return categoryMatches && titleMatches;
    });

    const pageCount = Math.max(
      1,
      Math.ceil(filtered.length / pageSize)
    );

    page = Math.min(page, pageCount);

    const visiblePosts = filtered.slice(
      (page - 1) * pageSize,
      page * pageSize
    );

    list.replaceChildren();

    if (visiblePosts.length === 0) {
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

    visiblePosts.forEach(post => {
      const row = createElement("li", "board-post-item");

      const categoryLabel = createElement(
        "span",
        "board-post-category",
        names[post.category] || "공지"
      );

      const link = createElement(
        "a",
        "board-post-link",
        post.title
      );

      link.href = `#post=${encodeURIComponent(post.id)}`;

      const date = createElement("time", "", post.date);

      row.append(categoryLabel, link, date);
      list.append(row);
    });

    /* 페이지 버튼 */
    pagination.replaceChildren();

    for (let number = 1; number <= pageCount; number++) {
      const button = createElement(
        "button",
        number === page ? "active" : "",
        String(number)
      );

      button.type = "button";
      button.setAttribute("aria-label", `${number}페이지`);

      if (number === page) {
        button.setAttribute("aria-current", "page");
      }

      button.addEventListener("click", () => {
        page = number;
        renderBoard();
      });

      pagination.append(button);
    }
  }

  /* 분류 선택 */
  filters.forEach(button => {
    button.addEventListener("click", () => {
      category = button.dataset.boardCategory;
      page = 1;

      filters.forEach(filter => {
        const selected = filter === button;

        filter.classList.toggle("active", selected);
        filter.setAttribute("aria-pressed", String(selected));
      });

      renderBoard();
    });
  });

  /* 제목 검색 */
  searchForm.addEventListener("submit", event => {
    event.preventDefault();

    keyword = searchForm.elements.keyword.value.trim();
    page = 1;

    renderBoard();
  });

  /* 글쓰기 창 */
  document.querySelector("#voda-board-write")
    .addEventListener("click", () => {
      error.textContent = "";
      dialog.showModal();
    });

  document.querySelector("#voda-board-close")
    .addEventListener("click", () => {
      dialog.close();
    });

  /* 글 등록 */
  writeForm.addEventListener("submit", event => {
    event.preventDefault();

    const data = new FormData(writeForm);

    const title = String(data.get("title") || "").trim();
    const content = String(data.get("content") || "").trim();
    const selectedCategory = String(data.get("category"));

    if (!title || !content) {
      error.textContent = "제목과 내용을 입력해주세요.";
      return;
    }

    const now = new Date();

    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join(".");

    const post = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      content,
      category: selectedCategory,
      pinned: data.has("pinned"),
      date,
      createdAt: now.getTime()
    };

    // 저장 시 최신 목록을 다시 읽어서 합침
    const updatedPosts = [post, ...loadPosts()].sort(
      (a, b) => b.createdAt - a.createdAt
    );

    try {
      savePosts(updatedPosts);
    } catch {
      error.textContent =
        "저장하지 못했습니다. 브라우저 저장 공간과 설정을 확인해주세요.";
      return;
    }

    boardPosts = updatedPosts;

    writeForm.reset();
    dialog.close();

    category = "all";
    keyword = "";
    page = 1;
    searchForm.reset();

    filters.forEach(button => {
      const selected = button.dataset.boardCategory === "all";

      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    renderBoard();
  });

  /* 상세 화면: Home에서 ?id=...로 들어오는 경우도 지원 */
  function showPostFromURL() {
    const hashParameters = new URLSearchParams(
      location.hash.slice(1)
    );

    const id =
      hashParameters.get("post") ||
      new URLSearchParams(location.search).get("id");

    if (!id) {
      listView.hidden = false;
      detailView.hidden = true;
      return;
    }

    const post = boardPosts.find(item => item.id === id);

    listView.hidden = true;
    detailView.hidden = false;

    detailView.querySelector("h2").textContent =
      post ? post.title : "게시글을 찾을 수 없습니다.";

    detailView.querySelector(".board-detail-meta").textContent =
      post ? `${names[post.category] || "공지"} · ${post.date}` : "";

    detailView.querySelector(".board-detail-body").textContent =
      post ? post.content : "";
  }

  document.querySelector("#voda-board-back")
    .addEventListener("click", () => {
      history.pushState(null, "", location.pathname);
      showPostFromURL();
    });

  window.addEventListener("hashchange", showPostFromURL);
  window.addEventListener("popstate", showPostFromURL);

  renderBoard();
  showPostFromURL();
})();