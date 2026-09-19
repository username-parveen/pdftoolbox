use std::collections::BTreeSet;

pub fn parse_page_range(
    input: &str,
    total_pages: u32,
    zero_indexed: bool,
) -> Result<Vec<u32>, String> {
    if total_pages == 0 {
        return Err("document has no pages".into());
    }
    if input.trim().is_empty() {
        return Err("page range is empty".into());
    }

    let mut pages = BTreeSet::new();
    for raw_part in input.split(',') {
        let part = raw_part.trim();
        if part.is_empty() {
            return Err("page range contains an empty item".into());
        }

        let bounds: Vec<&str> = part.split('-').map(str::trim).collect();
        let (start, end) = match bounds.as_slice() {
            [single] => {
                let page = parse_page(single, total_pages)?;
                (page, page)
            }
            [start, end] => {
                let start = parse_page(start, total_pages)?;
                let end = parse_page(end, total_pages)?;
                if start > end {
                    return Err(format!("range start {start} is after end {end}"));
                }
                (start, end)
            }
            _ => return Err(format!("invalid page item: {part}")),
        };

        pages.extend(start..=end);
    }

    Ok(pages
        .into_iter()
        .map(|page| if zero_indexed { page - 1 } else { page })
        .collect())
}

fn parse_page(value: &str, total_pages: u32) -> Result<u32, String> {
    let page = value
        .parse::<u32>()
        .map_err(|_| format!("invalid page number: {value}"))?;
    if page == 0 || page > total_pages {
        return Err(format!("page {page} is outside 1-{total_pages}"));
    }
    Ok(page)
}

#[cfg(test)]
mod tests {
    use super::parse_page_range;

    #[test]
    fn parses_sorts_and_deduplicates_ranges() {
        assert_eq!(
            parse_page_range("8, 1-3, 2, 6-7", 10, false).unwrap(),
            vec![1, 2, 3, 6, 7, 8]
        );
    }

    #[test]
    fn can_return_zero_indexed_pages() {
        assert_eq!(parse_page_range("1,3-4", 4, true).unwrap(), vec![0, 2, 3]);
    }

    #[test]
    fn rejects_invalid_or_out_of_bounds_ranges() {
        assert!(parse_page_range("0,2", 5, false).is_err());
        assert!(parse_page_range("3-2", 5, false).is_err());
        assert!(parse_page_range("1-6", 5, false).is_err());
        assert!(parse_page_range("1,,2", 5, false).is_err());
    }
}
