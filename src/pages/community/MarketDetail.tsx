import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SiteHeader from '../../components/layout/SiteHeader';
import { useAuthStore } from '../../store/authStore';
import { useUsedMarketStore } from '../../store/usedMarketStore';
import './MarketDetail.css';

function formatPrice(value: number) {
  return `${value.toLocaleString('ko-KR')}원`;
}

function formatDate(value: number) {
  return new Date(value).toLocaleDateString('ko-KR');
}

function getStatusLabel(status: string) {
  if (status === 'reserved') return '예약중';
  if (status === 'wanted') return '구매희망';
  return '판매중';
}

function getTradeLabel(tradeType: string) {
  if (tradeType === 'direct') return '직거래';
  if (tradeType === 'delivery') return '택배거래';
  return '직거래 / 택배';
}

export default function MarketDetail() {
  const navigate = useNavigate();
  const { itemId } = useParams<{ itemId: string }>();
  const user = useAuthStore((state) => state.user);
  const items = useUsedMarketStore((state) => state.items);
  const favoriteItemIdsByUser = useUsedMarketStore((state) => state.favoriteItemIdsByUser);
  const seedMarket = useUsedMarketStore((state) => state.seedMarket);
  const toggleFavorite = useUsedMarketStore((state) => state.toggleFavorite);
  const recordView = useUsedMarketStore((state) => state.recordView);

  useEffect(() => {
    void seedMarket().catch((error) => {
      console.error(error);
    });
  }, [seedMarket]);

  const item = useMemo(() => items.find((marketItem) => marketItem.id === itemId) ?? null, [itemId, items]);
  const isFavorite = !!user && !!item && (favoriteItemIdsByUser[user.email] ?? []).includes(item.id);

  useEffect(() => {
    if (!itemId) {
      return;
    }

    void recordView(itemId).catch((error) => {
      console.error(error);
    });
  }, [itemId, recordView]);

  if (!item) {
    return (
      <div className="market-detail-page">
        <SiteHeader activeSection="community" />
        <main className="market-detail-shell">
          <section className="market-detail-empty">
            <strong>선택한 상품을 찾을 수 없습니다.</strong>
            <button type="button" onClick={() => navigate('/community/market')}>
              중고거래로 돌아가기
            </button>
          </section>
        </main>
      </div>
    );
  }

  const visualStyle = item.imageUrl
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(10, 12, 16, 0.08), rgba(10, 12, 16, 0.3)), url(${item.imageUrl})`,
      }
    : { backgroundImage: item.palette };

  return (
    <div className="market-detail-page">
      <SiteHeader activeSection="community" />

      <main className="market-detail-shell">
        <section className="market-detail-hero">
          <div className="market-detail-visual" style={visualStyle} aria-hidden="true">
            <span className={`market-detail-status is-${item.status}`}>{getStatusLabel(item.status)}</span>
            {item.urgent ? <span className="market-detail-urgent">급매</span> : null}
          </div>

          <div className="market-detail-copy">
            <span className="market-detail-kicker">{item.brand}</span>
            <h1>{item.title}</h1>
            <p>{item.description}</p>

            <div className="market-detail-meta">
              <span>{item.condition}</span>
              <span>{getTradeLabel(item.tradeType)}</span>
              <span>{formatDate(item.createdAt)}</span>
              <span>조회 {item.viewCount.toLocaleString('ko-KR')}</span>
              <span>찜 {item.favoriteCount.toLocaleString('ko-KR')}</span>
            </div>

            <strong className="market-detail-price">{formatPrice(item.price)}</strong>

            <div className="market-detail-actions">
              <button type="button" className="market-detail-button is-primary" onClick={() => navigate('/messages')}>
                판매자에게 메시지
              </button>
              <button
                type="button"
                className="market-detail-button"
                onClick={async () => {
                  if (!user) {
                    navigate('/login');
                    return;
                  }
                  await toggleFavorite(item.id, user.email);
                }}
              >
                {isFavorite ? '찜 취소' : '찜하기'}
              </button>
              <button type="button" className="market-detail-button" onClick={() => navigate('/community/market')}>
                목록으로 돌아가기
              </button>
            </div>
          </div>
        </section>

        <section className="market-detail-grid">
          <article className="market-detail-panel">
            <div className="market-detail-panel-head">
              <strong>상품 정보</strong>
            </div>

            <div className="market-detail-info-list">
              <div className="market-detail-info-item">
                <span>브랜드</span>
                <strong>{item.brand}</strong>
              </div>
              <div className="market-detail-info-item">
                <span>카테고리</span>
                <strong>{item.category}</strong>
              </div>
              <div className="market-detail-info-item">
                <span>거래 방식</span>
                <strong>{getTradeLabel(item.tradeType)}</strong>
              </div>
              <div className="market-detail-info-item">
                <span>상태</span>
                <strong>{item.condition}</strong>
              </div>
              <div className="market-detail-info-item">
                <span>거래 지역</span>
                <strong>{item.location}</strong>
              </div>
              <div className="market-detail-info-item">
                <span>판매자</span>
                <strong>{item.sellerName}</strong>
              </div>
            </div>
          </article>

          <article className="market-detail-panel">
            <div className="market-detail-panel-head">
              <strong>거래 메모</strong>
            </div>

            <div className="market-detail-note-list">
              <p>사진에 보이는 외관과 실제 구성품이 같은지 거래 전에 한 번 더 확인해 주세요.</p>
              <p>직거래라면 이동 가능한 장소와 시간을 먼저 메시지로 맞추는 편이 안전합니다.</p>
              <p>택배거래라면 포장 상태와 송장 전달 여부를 미리 확인하면 좋아요.</p>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
