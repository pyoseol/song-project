import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CommunitySpaceNav from '../../components/community/CommunitySpaceNav';
import SiteHeader from '../../components/layout/SiteHeader';
import { useAuthStore } from '../../store/authStore';
import { useUsedMarketStore } from '../../store/usedMarketStore';
import type { MarketCategoryKey, MarketItem, MarketStatusKey, MarketTradeKey } from '../../types/market';
import { uploadMarketImageOnServer } from '../../utils/marketApi';
import './UsedMarket.css';

type CategoryKey = 'all' | MarketCategoryKey;
type StatusKey = 'all' | MarketStatusKey;
type TradeKey = 'all' | MarketTradeKey;
type SortKey = 'latest' | 'low' | 'high';

type DraftItem = {
  title: string;
  brand: string;
  category: MarketCategoryKey;
  tradeType: MarketTradeKey;
  condition: string;
  location: string;
  price: string;
  description: string;
  urgent: boolean;
};

const CATEGORY_ITEMS: Array<{ key: CategoryKey; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'keyboard', label: '건반/신디' },
  { key: 'midi', label: '미디 장비' },
  { key: 'interface', label: '오디오 인터페이스' },
  { key: 'microphone', label: '마이크' },
  { key: 'monitor', label: '모니터 스피커' },
  { key: 'guitar', label: '기타/페달' },
  { key: 'etc', label: '기타 장비' },
];

const STATUS_ITEMS: Array<{ key: StatusKey; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'sale', label: '판매중' },
  { key: 'reserved', label: '예약중' },
  { key: 'wanted', label: '구매희망' },
];

const TRADE_ITEMS: Array<{ key: TradeKey; label: string }> = [
  { key: 'all', label: '전체 거래' },
  { key: 'direct', label: '직거래' },
  { key: 'delivery', label: '택배거래' },
  { key: 'both', label: '둘 다 가능' },
];

const SORT_ITEMS: Array<{ key: SortKey; label: string }> = [
  { key: 'latest', label: '최신순' },
  { key: 'low', label: '낮은 가격' },
  { key: 'high', label: '높은 가격' },
];

const PAGE_SIZE = 12;
const DEFAULT_PALETTE =
  'linear-gradient(145deg, rgba(80, 88, 110, 0.95) 0%, rgba(35, 38, 48, 1) 100%)';

const EMPTY_DRAFT: DraftItem = {
  title: '',
  brand: '',
  category: 'keyboard',
  tradeType: 'both',
  condition: '',
  location: '',
  price: '',
  description: '',
  urgent: false,
};

function matchesSearch(item: MarketItem, keyword: string) {
  if (!keyword) return true;
  return [item.title, item.brand, item.location, item.condition].some((value) =>
    value.toLowerCase().includes(keyword)
  );
}

function formatPrice(value: number) {
  return `${value.toLocaleString('ko-KR')}원`;
}

function getStatusLabel(status: MarketStatusKey) {
  if (status === 'reserved') return '예약중';
  if (status === 'wanted') return '구매희망';
  return '판매중';
}

function getTradeLabel(tradeType: MarketTradeKey) {
  if (tradeType === 'direct') return '직거래';
  if (tradeType === 'delivery') return '택배거래';
  return '직거래/택배';
}

function sortItems(items: MarketItem[], sortKey: SortKey) {
  const sorted = [...items];
  if (sortKey === 'low') return sorted.sort((a, b) => a.price - b.price);
  if (sortKey === 'high') return sorted.sort((a, b) => b.price - a.price);
  return sorted.sort((a, b) => b.createdAt - a.createdAt);
}

function getCardVisualStyle(item: MarketItem) {
  if (item.imageUrl) {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(12, 14, 18, 0.08), rgba(12, 14, 18, 0.36)), url(${item.imageUrl})`,
    };
  }

  return { backgroundImage: item.palette };
}

export default function UsedMarket() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const items = useUsedMarketStore((state) => state.items);
  const favoriteItemIdsByUser = useUsedMarketStore((state) => state.favoriteItemIdsByUser);
  const seedMarket = useUsedMarketStore((state) => state.seedMarket);
  const toggleFavorite = useUsedMarketStore((state) => state.toggleFavorite);
  const createItem = useUsedMarketStore((state) => state.createItem);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusKey>('all');
  const [selectedTrade, setSelectedTrade] = useState<TradeKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('latest');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draft, setDraft] = useState<DraftItem>(EMPTY_DRAFT);
  const [draftImageFile, setDraftImageFile] = useState<File | null>(null);
  const [draftImagePreviewUrl, setDraftImagePreviewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void seedMarket().catch((error) => {
      console.error(error);
    });
  }, [seedMarket]);

  const favoriteIds = user ? favoriteItemIdsByUser[user.email] ?? [] : [];

  const categoryCounts = useMemo(
    () =>
      CATEGORY_ITEMS.reduce<Record<CategoryKey, number>>(
        (counts, item) => {
          counts[item.key] =
            item.key === 'all' ? items.length : items.filter((marketItem) => marketItem.category === item.key).length;
          return counts;
        },
        { all: 0, keyboard: 0, midi: 0, interface: 0, microphone: 0, monitor: 0, guitar: 0, etc: 0 }
      ),
    [items]
  );

  const filteredItems = useMemo(
    () =>
      sortItems(
        items.filter((item) => {
          const categoryMatch = selectedCategory === 'all' || item.category === selectedCategory;
          const statusMatch = selectedStatus === 'all' || item.status === selectedStatus;
          const tradeMatch = selectedTrade === 'all' || item.tradeType === selectedTrade;
          return categoryMatch && statusMatch && tradeMatch && matchesSearch(item, searchKeyword.trim().toLowerCase());
        }),
        sortKey
      ),
    [items, searchKeyword, selectedCategory, selectedStatus, selectedTrade, sortKey]
  );

  const marketMetrics = [
    { label: '전체 상품', value: items.length },
    { label: '판매중', value: items.filter((item) => item.status === 'sale').length },
    { label: '예약중', value: items.filter((item) => item.status === 'reserved').length },
    { label: '급매', value: items.filter((item) => item.urgent).length },
    { label: '직거래 가능', value: items.filter((item) => item.tradeType !== 'delivery').length },
    { label: '택배 가능', value: items.filter((item) => item.tradeType !== 'direct').length },
  ];

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const visibleItems = filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  const updatePage = () => setCurrentPage(1);

  const resetDraft = () => {
    if (draftImagePreviewUrl) {
      URL.revokeObjectURL(draftImagePreviewUrl);
    }
    setDraft(EMPTY_DRAFT);
    setDraftImageFile(null);
    setDraftImagePreviewUrl('');
    setIsSubmitting(false);
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    resetDraft();
  };

  const handleDraftImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (draftImagePreviewUrl) {
      URL.revokeObjectURL(draftImagePreviewUrl);
    }

    if (!file) {
      setDraftImageFile(null);
      setDraftImagePreviewUrl('');
      return;
    }

    setDraftImageFile(file);
    setDraftImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleCreateItem = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!draft.title.trim() || !draft.brand.trim() || !draft.location.trim() || !draft.price.trim()) {
      alert('제목, 브랜드, 거래 지역, 가격은 꼭 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadedImage = draftImageFile ? await uploadMarketImageOnServer(draftImageFile) : undefined;
      const itemId = await createItem({
        title: draft.title.trim(),
        brand: draft.brand.trim(),
        category: draft.category,
        status: 'sale',
        tradeType: draft.tradeType,
        condition: draft.condition.trim() || '상태 설명 예정',
        location: draft.location.trim(),
        price: Number(draft.price) || 0,
        urgent: draft.urgent,
        palette: DEFAULT_PALETTE,
        sellerName: user.name,
        sellerEmail: user.email,
        description: draft.description.trim() || '상세 설명이 아직 없습니다.',
        imageUrl: uploadedImage?.imageUrl,
        imageStorageKey: uploadedImage?.imageStorageKey,
        imageFileName: uploadedImage?.imageFileName,
      });

      closeCreateModal();
      navigate(`/community/market/${itemId}`);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      alert(`상품 등록에 실패했습니다.\n\n${message}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="used-market-page">
      <SiteHeader activeSection="community" />

      <main className="used-market-shell">
        <CommunitySpaceNav active="market" />

        <aside className="used-market-sidebar">
          <div className="used-market-sidebar-head">
            <span className="used-market-sidebar-kicker">USED MARKET</span>
            <strong>커뮤니티 중고 거래</strong>
            <p>사진과 조건을 함께 올리고, 필요한 장비를 빠르게 찾아보세요.</p>
          </div>

          <div className="used-market-sidebar-list">
            {CATEGORY_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`used-market-sidebar-button${selectedCategory === item.key ? ' is-active' : ''}`}
                onClick={() => {
                  setSelectedCategory(item.key);
                  updatePage();
                }}
              >
                <span>{item.label}</span>
                <strong>{categoryCounts[item.key]}</strong>
              </button>
            ))}
          </div>

          <div className="used-market-sidebar-note">
            <span className="used-market-sidebar-note-label">TODAY</span>
            <strong>대표 사진이 있는 상품은 카드에서 바로 상태와 외관을 확인할 수 있어요.</strong>
          </div>

          <div className="used-market-sidebar-links">
            <button type="button" className="used-market-sidebar-link" onClick={() => navigate('/community')}>
              커뮤니티 게시판
            </button>
            <button type="button" className="used-market-sidebar-link" onClick={() => navigate('/community/music')}>
              음악 공유
            </button>
          </div>
        </aside>

        <section className="used-market-content">
          <div className="used-market-content-head">
            <div>
              <span className="used-market-content-kicker">COMMUNITY MARKET</span>
              <h1 className="used-market-title">중고거래</h1>
              <p className="used-market-description">검색, 상태, 거래 방식 필터로 원하는 장비를 빠르게 골라보세요.</p>
            </div>
            <button type="button" className="used-market-primary-button" onClick={() => setIsCreateOpen(true)}>
              상품 등록
            </button>
          </div>

          <div className="used-market-stat-grid">
            {marketMetrics.map((metric) => (
              <article key={metric.label} className="used-market-stat-card">
                <span>{metric.label}</span>
                <strong>{metric.value.toLocaleString('ko-KR')}</strong>
              </article>
            ))}
          </div>

          <div className="used-market-toolbar">
            <div className="used-market-toolbar-head">
              <label className="used-market-search" aria-label="중고거래 검색">
                <input
                  type="search"
                  value={searchKeyword}
                  onChange={(event) => {
                    setSearchKeyword(event.target.value);
                    updatePage();
                  }}
                  placeholder="장비명, 브랜드, 지역으로 검색"
                />
              </label>
              <div className="used-market-sort-tabs" role="tablist" aria-label="정렬 방식">
                {SORT_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`used-market-sort-button${sortKey === item.key ? ' is-active' : ''}`}
                    onClick={() => {
                      setSortKey(item.key);
                      updatePage();
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="used-market-filter-block">
              <span className="used-market-filter-label">거래 상태</span>
              <div className="used-market-chip-row">
                {STATUS_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`used-market-chip${selectedStatus === item.key ? ' is-active' : ''}`}
                    onClick={() => {
                      setSelectedStatus(item.key);
                      updatePage();
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="used-market-filter-block">
              <span className="used-market-filter-label">거래 방식</span>
              <div className="used-market-chip-row">
                {TRADE_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`used-market-chip${selectedTrade === item.key ? ' is-active' : ''}`}
                    onClick={() => {
                      setSelectedTrade(item.key);
                      updatePage();
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="used-market-grid">
            {visibleItems.map((item) => {
              const isFavorite = favoriteIds.includes(item.id);
              return (
                <article
                  key={item.id}
                  className="used-market-card"
                  onClick={() => navigate(`/community/market/${item.id}`)}
                >
                  <div className="used-market-card-visual" style={getCardVisualStyle(item)}>
                    <span className={`used-market-status-chip is-${item.status}`}>{getStatusLabel(item.status)}</span>
                    {item.urgent ? <span className="used-market-urgent-chip">급매</span> : null}
                  </div>
                  <div className="used-market-card-body">
                    <div className="used-market-card-head">
                      <div className="used-market-card-copy">
                        <span className="used-market-card-brand">{item.brand}</span>
                        <strong>{item.title}</strong>
                      </div>
                      <button
                        type="button"
                        className={`used-market-favorite-button${isFavorite ? ' is-active' : ''}`}
                        onClick={async (event) => {
                          event.stopPropagation();
                          if (!user) {
                            navigate('/login');
                            return;
                          }
                          await toggleFavorite(item.id, user.email);
                        }}
                        aria-label={isFavorite ? '찜 취소' : '찜하기'}
                      >
                        {isFavorite ? '♥' : '♡'}
                      </button>
                    </div>
                    <div className="used-market-card-meta">
                      <span>{item.location}</span>
                      <span>{item.condition}</span>
                      <span>{getTradeLabel(item.tradeType)}</span>
                    </div>
                    <div className="used-market-card-footer">
                      <strong>{formatPrice(item.price)}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="used-market-footer">
            <p className="used-market-result-copy">현재 조건에 맞는 상품 {filteredItems.length}개</p>
            <div className="used-market-pagination">
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={`used-market-page-button${safePage === pageNumber ? ' is-active' : ''}`}
                  onClick={() => setCurrentPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      <button
        type="button"
        className="used-market-floating-action"
        onClick={() => setIsCreateOpen(true)}
      >
        상품 등록
      </button>

      {isCreateOpen ? (
        <div className="used-market-modal-backdrop" onClick={closeCreateModal}>
          <section className="used-market-modal" onClick={(event) => event.stopPropagation()}>
            <div className="used-market-modal-head">
              <div>
                <strong>중고거래 상품 등록</strong>
                <p>대표 사진을 함께 올리면 목록과 상세 화면에 바로 표시됩니다.</p>
              </div>
              <button type="button" className="used-market-modal-close" onClick={closeCreateModal}>
                ×
              </button>
            </div>

            <div className="used-market-modal-grid">
              <label className="used-market-modal-field">
                <span>상품명</span>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="예: Scarlett Solo 4th Gen"
                />
              </label>

              <label className="used-market-modal-field">
                <span>브랜드</span>
                <input
                  type="text"
                  value={draft.brand}
                  onChange={(event) => setDraft((current) => ({ ...current, brand: event.target.value }))}
                  placeholder="예: Focusrite"
                />
              </label>

              <label className="used-market-modal-field">
                <span>카테고리</span>
                <select
                  value={draft.category}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, category: event.target.value as MarketCategoryKey }))
                  }
                >
                  {CATEGORY_ITEMS.filter((item) => item.key !== 'all').map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="used-market-modal-field">
                <span>거래 방식</span>
                <select
                  value={draft.tradeType}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, tradeType: event.target.value as MarketTradeKey }))
                  }
                >
                  {TRADE_ITEMS.filter((item) => item.key !== 'all').map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="used-market-modal-field">
                <span>상태 설명</span>
                <input
                  type="text"
                  value={draft.condition}
                  onChange={(event) => setDraft((current) => ({ ...current, condition: event.target.value }))}
                  placeholder="예: 실사용 적음, 박스 포함"
                />
              </label>

              <label className="used-market-modal-field">
                <span>거래 지역</span>
                <input
                  type="text"
                  value={draft.location}
                  onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
                  placeholder="예: 서울 성수"
                />
              </label>

              <label className="used-market-modal-field">
                <span>가격</span>
                <input
                  type="number"
                  min={0}
                  value={draft.price}
                  onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}
                  placeholder="원 단위 숫자"
                />
              </label>

              <label className="used-market-modal-field">
                <span>대표 사진</span>
                <input type="file" accept="image/*" onChange={handleDraftImageChange} />
              </label>
            </div>

            {draftImagePreviewUrl ? (
              <div className="used-market-modal-preview">
                <div
                  className="used-market-modal-preview-visual"
                  style={{ backgroundImage: `url(${draftImagePreviewUrl})` }}
                />
                <div className="used-market-modal-preview-copy">
                  <strong>{draftImageFile?.name ?? '대표 사진'}</strong>
                  <button
                    type="button"
                    onClick={() => {
                      if (draftImagePreviewUrl) {
                        URL.revokeObjectURL(draftImagePreviewUrl);
                      }
                      setDraftImageFile(null);
                      setDraftImagePreviewUrl('');
                    }}
                  >
                    사진 제거
                  </button>
                </div>
              </div>
            ) : null}

            <label className="used-market-modal-field">
              <span>상세 설명</span>
              <textarea
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="구성품, 사용감, 거래 가능 시간 등을 적어주세요."
              />
            </label>

            <button
              type="button"
              className={`used-market-modal-toggle${draft.urgent ? ' is-active' : ''}`}
              onClick={() => setDraft((current) => ({ ...current, urgent: !current.urgent }))}
            >
              급매로 표시
            </button>

            <div className="used-market-modal-actions">
              <button type="button" className="used-market-modal-button" onClick={closeCreateModal}>
                취소
              </button>
              <button
                type="button"
                className="used-market-modal-button is-primary"
                onClick={handleCreateItem}
                disabled={isSubmitting}
              >
                {isSubmitting ? '등록 중...' : '등록하기'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
