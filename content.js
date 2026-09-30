(() => {
  "use strict";

  /* ==================================================
     01. 기본 설정과 표시 영역
     admin.js와 같은 저장소 이름을 사용합니다.
  ================================================== */

  const DATABASE_NAME = "voda-content-v1";
  const DATABASE_VERSION = 1;

  const projectsRoot = document.querySelector("#managed-projects");
  const activitiesRoot = document.querySelector("#managed-activities");

  // 프로젝트·활동 표시 영역이 없는 페이지에서는 실행하지 않습니다.
  if (!projectsRoot && !activitiesRoot) return;

  // 브라우저에 저장된 사진을 표시하기 위한 임시 주소
  const imageURLs = new Set();

  /* ==================================================
     02. 공통 화면 요소
     등록한 글은 HTML로 해석하지 않고 일반 글자로 표시합니다.
  ================================================== */

  function makeElement(tag, className = "", text) {
    const node = document.createElement(tag);

    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;

    return node;
  }

  function showMessage(root, text, isError = false) {
    const message = makeElement("p", "managed-empty", text);

    message.setAttribute("role", isError ? "alert" : "status");
    root.replaceChildren(message);
  }

  function validPhotos(item) {
    if (!Array.isArray(item.photos)) return [];

    return item.photos.filter(
      photo => photo && photo.blob instanceof Blob
    );
  }

  /* ==================================================
     03. 저장소 연결과 목록 읽기
     읽기가 끝나면 데이터베이스 연결을 닫습니다.
  ================================================== */

  function openDatabase() {
    return new Promise((resolve, reject) => {
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

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);

      request.onblocked = () => {
        for (const root of [projectsRoot, activitiesRoot]) {
          if (!root) continue;

          showMessage(
            root,
            "저장소 연결이 대기 중입니다. 다른 VODA 탭을 닫고 확인해주세요."
          );
        }
      };
    });
  }

  async function readItems(storeName) {
    const database = await openDatabase();

    try {
      const items = await new Promise((resolve, reject) => {
        const transaction = database.transaction(
          storeName,
          "readonly"
        );

        const request = transaction
          .objectStore(storeName)
          .getAll();

        transaction.oncomplete = () => resolve(request.result);

        transaction.onerror = () => {
          reject(transaction.error || request.error);
        };

        transaction.onabort = () => {
          reject(
            transaction.error ||
            request.error ||
            new Error("목록 읽기가 중단되었습니다.")
          );
        };
      });

      const valid = Array.isArray(items) && items.every(item =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.title === "string"
      );

      if (!valid) {
        throw new Error("저장 데이터 형식이 올바르지 않습니다.");
      }

      // 최근 등록한 항목을 먼저 표시합니다.
      return items.sort(
        (a, b) => (Number(b.createdAt) || 0) -
                  (Number(a.createdAt) || 0)
      );
    } finally {
      database.close();
    }
  }

  /* ==================================================
     04. 사진 표시
     사진 파일이 깨진 경우 안내 문구로 대체합니다.
  ================================================== */

  function makePhoto(photo, description, onError) {
    const img = document.createElement("img");
    const url = URL.createObjectURL(photo.blob);

    imageURLs.add(url);

    img.alt = description;
    img.loading = "lazy";
    img.decoding = "async";

    img.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      imageURLs.delete(url);
      onError();
    }, { once: true });

    img.src = url;

    return img;
  }

  function makeActivityPlaceholder(text) {
    const placeholder = makeElement(
      "div",
      "activity-photo-placeholder"
    );

    const icon = makeElement("span", "", "▧");
    icon.setAttribute("aria-hidden", "true");

    placeholder.append(
      icon,
      makeElement("p", "", text)
    );

    return placeholder;
  }

  /* ==================================================
     05. 프로젝트 목록
     글·대표 이미지·외부 링크를 표시합니다.
  ================================================== */

  function makeProjectLink(value) {
    if (typeof value !== "string" || !value.trim()) return null;

    try {
      const url = new URL(value);

      // 일반 웹 주소만 외부 링크로 허용합니다.
      if (!["http:", "https:"].includes(url.protocol)) return null;

      const link = makeElement(
        "a",
        "managed-project-link",
        "프로젝트 보기 ↗"
      );

      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", "프로젝트 보기, 새 탭에서 열기");

      return link;
    } catch {
      return null;
    }
  }

  function renderProjects(items) {
    if (items.length === 0) {
      showMessage(projectsRoot, "등록된 프로젝트가 없습니다.");
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const item of items) {
      const article = makeElement("article", "project-entry");
      const copy = makeElement("div", "project-entry-copy");
      const image = makeElement("div", "project-entry-image");

      if (item.projectCategory) {
        copy.append(
          makeElement("span", "project-category", item.projectCategory)
        );
      }

      copy.append(
        makeElement("h2", "", item.title),
        makeElement("p", "", item.description || "")
      );

      const link = makeProjectLink(item.link);
      if (link) copy.append(link);

      const photo = validPhotos(item)[0];

      if (photo) {
        image.append(
          makePhoto(
            photo,
            `${item.title} 대표 이미지`,
            () => {
              image.replaceChildren(
                makeElement("span", "", "이미지를 표시할 수 없습니다.")
              );
            }
          )
        );
      } else {
        image.append(
          makeElement("span", "", "등록된 이미지가 없습니다.")
        );
      }

      article.append(copy, image);
      fragment.append(article);
    }

    projectsRoot.replaceChildren(fragment);
  }

  /* ==================================================
     06. 활동 사진 슬라이더
     화살표·위치 표시 버튼·키보드·좌우 밀기를 지원합니다.
     각 활동의 사진은 독립적으로 이동합니다.
  ================================================== */

  function createSlider(item) {
    const slider = makeElement("div", "activity-slider");
    const photoArea = makeElement("div", "activity-slides");
    const dotsArea = makeElement("div", "activity-dots");
    const status = makeElement("p", "activity-status sr-only");

    const photos = validPhotos(item);
    const slides = [];
    const dots = [];

    let current = 0;
    let touchStart = null;

    slider.setAttribute("role", "region");
    slider.setAttribute("aria-roledescription", "사진 슬라이더");
    slider.setAttribute("aria-label", `${item.title} 사진`);

    dotsArea.setAttribute("role", "group");
    dotsArea.setAttribute("aria-label", "사진 선택");

    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");

    // 사진이 없을 때도 기존 사진 영역의 크기를 유지합니다.
    if (photos.length === 0) {
      const slide = makeElement("div", "activity-slide");

      slide.append(
        makeActivityPlaceholder("등록된 사진이 없습니다.")
      );

      photoArea.append(slide);
      slides.push(slide);
    } else {
      photos.forEach((photo, index) => {
        const slide = makeElement("div", "activity-slide");

        slide.hidden = index !== 0;
        slide.setAttribute("role", "group");
        slide.setAttribute(
          "aria-label",
          `전체 ${photos.length}장 중 ${index + 1}번째 사진`
        );

        slide.append(
          makePhoto(
            photo,
            `${item.title} 사진 ${index + 1}`,
            () => {
              slide.replaceChildren(
                makeActivityPlaceholder("사진을 표시할 수 없습니다.")
              );
            }
          )
        );

        photoArea.append(slide);
        slides.push(slide);
      });
    }

    const previous = makeElement(
      "button",
      "activity-arrow activity-prev",
      "‹"
    );

    const next = makeElement(
      "button",
      "activity-arrow activity-next",
      "›"
    );

    previous.type = next.type = "button";
    previous.setAttribute("aria-label", "이전 사진");
    next.setAttribute("aria-label", "다음 사진");

    function show(index) {
      current = (index + slides.length) % slides.length;

      slides.forEach((slide, number) => {
        slide.hidden = number !== current;
      });

      dots.forEach((dot, number) => {
        const selected = number === current;

        dot.classList.toggle("active", selected);
        dot.setAttribute("aria-pressed", String(selected));
      });

      status.textContent = photos.length > 0
        ? `전체 ${photos.length}장 중 ${current + 1}번째 사진`
        : "등록된 사진이 없습니다.";
    }

    // 사진이 두 장 이상일 때만 위치 선택 버튼을 만듭니다.
    if (photos.length > 1) {
      photos.forEach((photo, index) => {
        const dot = makeElement("button", "activity-dot");

        dot.type = "button";
        dot.setAttribute("aria-label", `${index + 1}번째 사진 보기`);
        dot.addEventListener("click", () => show(index));

        dots.push(dot);
        dotsArea.append(dot);
      });
    }

    previous.hidden = next.hidden = photos.length <= 1;

    // 점 영역 높이는 CSS에서 유지해서 사진과 글 정렬을 맞춥니다.
    slider.append(photoArea, previous, next, dotsArea, status);

    previous.addEventListener("click", () => show(current - 1));
    next.addEventListener("click", () => show(current + 1));

    slider.addEventListener("keydown", event => {
      if (photos.length <= 1) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        show(current - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        show(current + 1);
      }
    });

    // 모바일에서 세로 스크롤과 구분해 좌우 밀기를 처리합니다.
    photoArea.addEventListener("touchstart", event => {
      touchStart = event.touches.length === 1
        ? {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY
          }
        : null;
    }, { passive: true });

    photoArea.addEventListener("touchmove", event => {
      if (event.touches.length !== 1) touchStart = null;
    }, { passive: true });

    photoArea.addEventListener("touchend", event => {
      const start = touchStart;
      touchStart = null;

      if (!start || photos.length <= 1) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const distanceX = touch.clientX - start.x;
      const distanceY = touch.clientY - start.y;

      if (
        Math.abs(distanceX) > 50 &&
        Math.abs(distanceX) > Math.abs(distanceY)
      ) {
        show(current + (distanceX < 0 ? 1 : -1));
      }
    }, { passive: true });

    photoArea.addEventListener("touchcancel", () => {
      touchStart = null;
    }, { passive: true });

    show(0);
    return slider;
  }

  /* ==================================================
     07. 활동 목록
     모든 활동에 같은 사진·설명 배치를 적용합니다.
  ================================================== */

  function renderActivities(items) {
    if (items.length === 0) {
      showMessage(activitiesRoot, "등록된 활동이 없습니다.");
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const item of items) {
      const article = makeElement("article", "activity-row");
      const copy = makeElement("div", "activity-copy");

      copy.append(
        makeElement("h2", "", item.title),
        makeElement("p", "", item.description || "")
      );

      article.append(createSlider(item), copy);
      fragment.append(article);
    }

    activitiesRoot.replaceChildren(fragment);
  }

  /* ==================================================
     08. 불러오기와 초기 실행
     각 목록의 오류는 해당 표시 영역에서 안내합니다.
  ================================================== */

  async function loadSection(root, storeName, render) {
    if (!root) return;

    root.setAttribute("aria-busy", "true");
    showMessage(root, "불러오는 중입니다.");

    try {
      const items = await readItems(storeName);
      render(items);
    } catch (error) {
      console.error(`[VODA] ${storeName} 목록 읽기 실패`, error);

      showMessage(
        root,
        "내용을 불러오지 못했습니다. 새로고침 후 다시 확인해주세요.",
        true
      );
    } finally {
      root.setAttribute("aria-busy", "false");
    }
  }

  /*
    뒤로가기로 복원될 페이지에서는 사진 주소를 유지합니다.
    페이지를 완전히 떠날 때만 임시 주소를 해제합니다.
  */
  window.addEventListener("pagehide", event => {
    if (event.persisted) return;

    imageURLs.forEach(url => URL.revokeObjectURL(url));
    imageURLs.clear();
  });

  loadSection(projectsRoot, "projects", renderProjects);
  loadSection(activitiesRoot, "activities", renderActivities);
})();