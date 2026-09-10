package pdf

import "strconv"

func money(value float64) string {
	return "$ " + strconv.FormatFloat(value, 'f', 2, 64)
}

func percent(value float64) string {
	return strconv.FormatFloat(value, 'f', 2, 64) + "%"
}
