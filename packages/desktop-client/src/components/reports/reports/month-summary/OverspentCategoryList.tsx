import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFormat } from '#hooks/useFormat';

type OverspentCategoryListProps = {
  categories: CategoryEntity[];
  amountsByCategory: Map<CategoryEntity['id'], IntegerAmount>;
};

export function OverspentCategoryList({
  categories,
  amountsByCategory,
}: OverspentCategoryListProps) {
  const format = useFormat();

  const sortedCategories = [...categories].sort(
    (a, b) =>
      (amountsByCategory.get(a.id) ?? 0) - (amountsByCategory.get(b.id) ?? 0),
  );

  if (sortedCategories.length === 0) {
    return null;
  }

  return (
    <View style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      {sortedCategories.map(category => (
        <View
          key={category.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: '6px 0',
            borderTop: '1px solid ' + theme.tableBorder,
          }}
        >
          <Text style={{ flex: 1, minWidth: 0, ...styles.lineClamp(1) }}>
            {category.name}
          </Text>
          <PrivacyFilter>
            <FinancialText style={{ color: theme.reportsNumberNegative }}>
              {format(amountsByCategory.get(category.id) ?? 0, 'financial')}
            </FinancialText>
          </PrivacyFilter>
        </View>
      ))}
    </View>
  );
}
