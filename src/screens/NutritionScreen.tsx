import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { WeekStrip } from '../components/WeekStrip';
import { useAppState, useDispatch } from '../state/store';
import { nutritionDay, nutritionProgress, nutritionStreak, weekDays } from '../state/selectors';
import { MEAL_NAMES, WATER_GOAL_GLASSES } from '../data/program';
import { formatLongDate, fromISODate, toISODate } from '../utils/date';

export function NutritionScreen() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [params, setParams] = useSearchParams();
  const today = new Date();

  const initialIso = params.get('date') ?? toISODate(today);
  const [selectedIso, setSelectedIso] = useState(initialIso);
  const selected = useMemo(() => fromISODate(selectedIso), [selectedIso]);

  const day = nutritionDay(state, selected);
  const overall = nutritionProgress(state);
  const streak = nutritionStreak(state, today);
  const days = weekDays(state, selected);
  const eaten = day.meals.filter(Boolean).length;

  const selectDate = (iso: string) => {
    setSelectedIso(iso);
    setParams(iso === toISODate(today) ? {} : { date: iso }, { replace: true });
  };

  return (
    <div className="screen">
      <AppHeader title="Харчування" subtitle={`${state.program.mealsPerDay} прийомів їжі на день`} />

      <div className="screen-body">
        <div className="stat-row">
          <div className="stat">
            <Icon name="meal" size={18} />
            <span className="stat__value num">
              {overall.done}/{overall.total}
            </span>
            <span className="stat__label dim">за програму</span>
          </div>
          <div className="stat">
            <Icon name="flame" size={18} />
            <span className="stat__value num">{streak}</span>
            <span className="stat__label dim">днів поспіль</span>
          </div>
          <div className="stat">
            <Icon name="check" size={18} />
            <span className="stat__value num">
              {eaten}/{state.program.mealsPerDay}
            </span>
            <span className="stat__label dim">
              {selectedIso === toISODate(today) ? 'сьогодні' : 'обраний день'}
            </span>
          </div>
        </div>

        <div className="section-gap">
          <ProgressBar ratio={overall.ratio} color="var(--success)" />
        </div>

        <div className="section-gap">
          <WeekStrip days={days} selectedIso={selectedIso} onSelect={(d) => selectDate(d.iso)} />
        </div>

        <p className="section-label section-gap">{formatLongDate(selected)}</p>

        <ul className="meal-list">
          {day.meals.map((done, index) => (
            <li key={index}>
              <button
                type="button"
                className={`meal-item${done ? ' meal-item--done' : ''}`}
                onClick={() =>
                  dispatch({ type: 'nutrition/toggleMeal', date: selectedIso, index })
                }
                aria-pressed={done}
              >
                <span className="meal-item__check">
                  {done && <Icon name="check" size={15} />}
                </span>
                <span className="meal-item__name">{MEAL_NAMES[index] ?? `Прийом ${index + 1}`}</span>
                <span className="meal-item__state dim">{done ? 'з’їдено' : 'відмітити'}</span>
              </button>
            </li>
          ))}
        </ul>

        <section className="water-card section-gap">
          <div className="row-between">
            <span>Вода</span>
            <span className="num">
              {day.water}/{WATER_GOAL_GLASSES} склянок
            </span>
          </div>
          <div className="water-glasses">
            {Array.from({ length: WATER_GOAL_GLASSES }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`water-glass${i < day.water ? ' water-glass--full' : ''}`}
                aria-label={`${i + 1} склянка води`}
                onClick={() =>
                  dispatch({
                    type: 'nutrition/setWater',
                    date: selectedIso,
                    // Tapping the last full glass empties it.
                    glasses: i + 1 === day.water ? i : i + 1,
                  })
                }
              />
            ))}
          </div>
          <p className="dim water-card__hint">
            {(day.water * 0.25).toFixed(2).replace('.', ',')} л із{' '}
            {(WATER_GOAL_GLASSES * 0.25).toFixed(1).replace('.', ',')} л
          </p>
        </section>
      </div>
    </div>
  );
}
